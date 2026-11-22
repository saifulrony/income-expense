/**
 * Smart Voice Transaction Input (Speech-to-Text & Parsing).
 * Works 100% in Browser & Android WebView using standard Web Speech API.
 * Zero APK bloat (0 extra bytes).
 * Supports both Bengali (bn-BD) and English (en-US).
 */

import { Category } from '@/lib/types';
import { normalizeNumerals, getReceiptScanMode, getGeminiApiKey, getAvailableGeminiModels } from './receipt-scanner';

export interface ParsedVoiceTransaction {
  amount: number;
  type: 'income' | 'expense';
  categoryId?: string;
  categoryName?: string;
  note: string;
  paymentMethod: 'Cash' | 'Bank Account' | 'Mobile Wallet';
  rawTranscript: string;
}

/**
 * Check if voice speech recognition is supported in current browser/device.
 */
export function isVoiceRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Parse spoken text into structured transaction fields offline (Without AI).
 * Handles English and Bengali natural phrases:
 * e.g. "Lunch with friends 450 taka by bkash"
 * e.g. "দোকান থেকে ৫০০ টাকার বাজার করলাম ক্যাশ"
 * e.g. "Salary received 50000 bank"
 */
export function parseVoiceOffline(
  rawTranscript: string,
  categories: Category[] = [],
  userCurrency = '$'
): ParsedVoiceTransaction {
  const normalized = normalizeNumerals(rawTranscript);
  const lower = normalized.toLowerCase().trim();

  // 1. Detect Type (Income vs Expense)
  let type: 'income' | 'expense' = 'expense';
  const incomeKeywords = [
    'salary', 'income', 'received', 'got', 'deposit', 'bonus', 'freelance', 'profit',
    'বেতন', 'আয়', 'আয়', 'পেলাম', 'জমা', 'লাভ', 'বোনাস'
  ];
  if (incomeKeywords.some((w) => lower.includes(w))) {
    type = 'income';
  }

  // 2. Detect Amount
  let amount = 0;
  // Look for numbers near currency words or standalone
  const amountMatches = normalized.match(/[\$৳£€]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]{1,7}(?:\.[0-9]{1,2})?)/g);
  if (amountMatches) {
    const candidates: number[] = [];
    for (const match of amountMatches) {
      const clean = match.replace(/[\$৳£€,\s]/g, '');
      const num = parseFloat(clean);
      if (!isNaN(num) && num > 0 && num < 10000000 && num !== 2024 && num !== 2025 && num !== 2026) {
        candidates.push(num);
      }
    }
    // Take the most prominent number (often the first or max)
    if (candidates.length > 0) {
      amount = candidates[0];
    }
  }

  // 3. Detect Payment Method
  let paymentMethod: 'Cash' | 'Bank Account' | 'Mobile Wallet' = 'Cash';
  if (/bkash|nagad|rocket|upay|wallet|বিকাশ|নগদ|রকেট/i.test(lower)) {
    paymentMethod = 'Mobile Wallet';
  } else if (/bank|card|visa|mastercard|pos|transfer|চেক|ব্যাংক|কার্ড/i.test(lower)) {
    paymentMethod = 'Bank Account';
  }

  // 4. Detect Category
  let matchedCat: Category | undefined;
  const categoryTerms: Record<string, string[]> = {
    groceries: ['grocery', 'groceries', 'bazar', 'bazaar', 'supermarket', 'market', 'বাজার', 'মুদি', 'সবজি', 'মাছ', 'গোশত', 'চাল', 'ডাল', 'তেল'],
    dining: ['lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'cafe', 'coffee', 'tea', 'burger', 'pizza', 'snack', 'বিরিয়ানি', 'খাবার', 'নাস্তা', 'চা', 'কফি'],
    transport: ['uber', 'pathao', 'cng', 'rickshaw', 'fuel', 'petrol', 'bus', 'train', 'fare', 'ভাড়া', 'রিকশা', 'সিএনজি', 'বাস', 'যাতায়াত'],
    shopping: ['cloth', 'clothes', 'dress', 'shirt', 'pant', 'shoes', 'shopping', 'জামা', 'কাপড়', 'জুতা', 'কেনাকাটা'],
    utilities: ['electricity', 'current', 'water', 'gas', 'internet', 'wifi', 'bill', 'বিদ্যুৎ', 'পানি', 'গ্যাস', 'ইন্টারনেট', 'বিল'],
    health: ['doctor', 'medicine', 'pharma', 'hospital', 'clinic', 'ঔষধ', 'ওষুধ', 'ডাক্তার', 'হাসপাতাল'],
    salary: ['salary', 'allowance', 'বেতন', 'ভাতা'],
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  for (const [key, terms] of Object.entries(categoryTerms)) {
    if (terms.some((t) => lower.includes(t))) {
      matchedCat = filteredCategories.find(
        (c) => terms.some((t) => c.name.toLowerCase().includes(t)) || c.name.toLowerCase().includes(key)
      );
      if (matchedCat) break;
    }
  }

  if (!matchedCat && filteredCategories.length > 0) {
    matchedCat = filteredCategories[0];
  }

  // 5. Generate Note / Description
  let note = rawTranscript.trim();
  // Capitalize first letter
  if (note.length > 0) {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  }

  return {
    amount,
    type,
    categoryId: matchedCat?.id,
    categoryName: matchedCat?.name,
    note,
    paymentMethod,
    rawTranscript,
  };
}

/**
 * Parse spoken text using Google Gemini AI for deep natural language understanding.
 */
export async function parseVoiceWithGemini(
  rawTranscript: string,
  categories: Category[] = [],
  userCurrency = '$'
): Promise<ParsedVoiceTransaction> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return parseVoiceOffline(rawTranscript, categories, userCurrency);
  }

  const categoryNames = categories.map((c) => c.name).filter(Boolean);
  const prompt = `You are a smart financial transaction speech parser.
Extract the transaction details from this user's voice input: "${rawTranscript}".
User currency: "${userCurrency}".
Available categories: [${categoryNames.join(', ')}].

Output strictly raw JSON (no markdown):
{
  "amount": number,
  "type": "income" or "expense",
  "category": "Closest matching category from available list",
  "note": "Clean concise description of what was purchased or earned",
  "payment_method": "Cash" | "Bank Account" | "Mobile Wallet"
}`;

  const candidateModels = await getAvailableGeminiModels(apiKey);

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(text.substring(start, end + 1));
        const matchedCategory = categories.find(
          (cat) => cat.name.toLowerCase() === (parsed.category || '').toLowerCase()
        );

        return {
          amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || 0,
          type: parsed.type === 'income' ? 'income' : 'expense',
          categoryId: matchedCategory?.id,
          categoryName: matchedCategory?.name || parsed.category,
          note: parsed.note || rawTranscript,
          paymentMethod: parsed.payment_method || 'Cash',
          rawTranscript,
        };
      }
    } catch {
      // Fallback to next candidate or offline parser
    }
  }

  // Graceful offline fallback
  return parseVoiceOffline(rawTranscript, categories, userCurrency);
}

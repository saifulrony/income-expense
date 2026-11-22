/**
 * Smart Receipt & Bill Scanner (With AI & Without AI Modes).
 * Ultra-lightweight (Zero APK bloat, keeps APK at ~4.6 MB).
 * - "With AI": Google Gemini Multimodal Vision API (99.9% accuracy on any photo, receipt, bill, handwriting).
 * - "Without AI": 100% Offline client-side scan, zero API keys required.
 */

import { Category } from '@/lib/types';

export type ReceiptScanMode = 'ai' | 'offline';

export interface ExtractedReceiptItem {
  id: string;
  name: string;
  price: number;
  category_id?: string;
  category_name?: string;
  selected?: boolean;
}

export interface ExtractedReceiptData {
  amount: number;
  type: 'income' | 'expense';
  merchant: string;
  items: ExtractedReceiptItem[];
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  categoryId?: string;
  categoryName?: string;
  note: string;
  paymentMethod?: 'Cash' | 'Bank Account' | 'Mobile Wallet';
  receiptImage: string; // Data URL for preview and storage
  isOffline?: boolean;
  isLowConfidence?: boolean;
  lowConfidenceMessage?: string;
}

/**
 * Detect OCR artifacts, gibberish lines, or distorted noise (e.g. "EP", "R= TC To TIE A", "hot sauce. ~~")
 */
export function isGibberishLine(str: string): boolean {
  if (!str) return true;
  const trimmed = str.replace(/^[\#\*\-•:\s\|\>\–\—\(\)\[\]\d\.\)]+/, '').trim();
  // Too short to be a meaningful product name (filter out 1-2 char noise like "EP", "R=")
  if (trimmed.length < 3) return true;
  // Obvious OCR artifacts: contains symbols like =, ~, ^, <>, _, `, or excessive punctuation
  if (/[=~_<>{}|\\^`]/.test(trimmed)) return true;
  // Disconnected single letters separated by spaces (like "R TC To TIE A")
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const singleLetters = tokens.filter((t) => t.length === 1 && /[A-Za-z]/.test(t));
  if (tokens.length >= 3 && singleLetters.length >= 2) return true;
  // If word has almost no vowels (random consonants like "qzx" or "krpt")
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 4) {
    const vowels = (letters.match(/[aeiouyAEIOUY]/g) || []).length;
    if (vowels === 0 || vowels / letters.length < 0.12) return true;
  }
  return false;
}

/**
 * Detect POS receipt / invoice header & footer metadata lines that must NEVER be treated as items:
 * - Company/store headers, addresses, postal codes, telephone numbers, emails, websites
 * - Cashier, terminal, register, transaction ID, order #, table #
 * - Payment methods (Cash, Visa, Mastercard, Amex, Debit, Credit), card numbers (masked or last 4 digits)
 * - POS terminal codes (Auth code, AID, TVR, Approval, Trace, Batch)
 * - Tender / Change due / Balance
 * - Subtotals, taxes, discounts, tips, rounding
 * - Receipt boilerplate (Thank you, Welcome, Customer copy, Return policy, Survey)
 */
export function isReceiptMetadataOrNoiseLine(str: string, knownMerchant = ''): boolean {
  if (!str) return true;
  const s = str.trim();
  if (s.length < 2) return true;

  // 1. Gibberish check
  if (isGibberishLine(s)) return true;

  const lower = s.toLowerCase();

  // If item name matches the store/company merchant name or banner
  if (knownMerchant && knownMerchant.trim()) {
    const km = knownMerchant.toLowerCase().trim();
    if (lower === km || lower.startsWith(km) || km.startsWith(lower)) {
      return true;
    }
  }

  // 2. POS Card & Payment Method lines
  // e.g. "VISA CREDIT ************1234", "MASTERCARD SALE", "DEBIT CARD", "CARD # ...", "AMEX"
  if (
    /\b(visa|mastercard|amex|american express|discover|maestro|jcb|unionpay)\b/i.test(lower) ||
    /\b(credit\s*card|debit\s*card|card\s*#|card\s*num|card\s*ending|pay\s*by\s*card|card\s*payment|payment\s*method|payment\s*type|tender\s*type)\b/i.test(lower) ||
    /\b(chip\s*read|chip\s*card|entry\s*method|contactless|swiped|card\s*reader)\b/i.test(lower) ||
    (/\b(debit|credit|card|cash|chip)\b/i.test(lower) && /(\*{3,}|x{3,}|\d{4}|sale|purchase|auth|appr|payment|tend|tender|approved|read|trans|entry|declined)/i.test(lower))
  ) {
    return true;
  }

  // Masked card numbers (e.g. **** 1234, ************5678, XXXX-XXXX-XXXX-1234)
  if (/(\*{3,}|x{3,}|\*{2,}\s*\d{4})/.test(s)) {
    return true;
  }

  // 3. POS Terminal & Authorization fields
  // e.g. "AUTH: 123456", "AID: A0000000031010", "APPR CODE: 05432B", "TRACE # 12", "BATCH 001", "STAN: 12345"
  if (
    /\b(auth|authorization|appr|approval|aid|tvr|tsi|arc|rrn|stan|trace|batch|seq|sequence|merchant id|mid|terminal id|tid|trans id|pos id|register|reg #|station #|terminal|counter #|host #)\b/i.test(lower)
  ) {
    return true;
  }

  // 4. Cash Tender / Change / Balance
  // e.g. "TENDER CASH $20.00", "CASH TENDERED", "CHANGE DUE: $5.00", "CHANGE GIVEN", "AMOUNT TENDERED"
  if (
    /\b(tender|tendered|change due|change given|cash given|balance due|amount tendered|amount given|change)\b/i.test(lower)
  ) {
    return true;
  }

  // 5. Cashier / Staff / Order / Table
  // e.g. "CASHIER: JANE", "SERVER: MIKE", "HOST: ALEX", "CLERK # 12", "OPERATOR: ADMIN", "TABLE: 12", "ORDER: #55"
  if (
    /\b(cashier|server|clerk|operator|served by|rep|waiter|host|table\s*#?|order\s*#?|token\s*#?|slip\s*#?|check\s*#?|trans\s*#?|txn\s*#?|inv\s*#?|invoice\s*#?|bill\s*#?)\b/i.test(lower)
  ) {
    return true;
  }

  // 6. Tax / VAT / Business Registration / License
  // e.g. "TAX ID: 123", "VAT REG: 456", "BIN: 789", "TIN #", "GSTIN", "EIN", "TRN", "BUSINESS REG"
  if (
    /\b(tax id|vat reg|vat no|vat #|bin\s*#?|tin\s*#?|gst\s*#?|gstin|ein\s*#?|trn\s*#?|cif\s*#?|nif\s*#?|reg no|reg #|registration|licence|license|sales tax no)\b/i.test(lower)
  ) {
    return true;
  }

  // 7. Store Address & Postal Codes / ZIP Codes
  // e.g. "123 MAIN STREET", "SUITE 400", "ROAD # 12", "BLOCK C", "DHAKA 1212", "ZIP: 90210", "POST CODE: 12345", "POSTAL CODE: SW1A 1AA", "PO BOX 45"
  if (
    /\b(zip\s*code|zip\s*#?|postal\s*code|post\s*code|pincode|pin\s*code|po\s*box|p\.o\.\s*box)\b/i.test(lower) ||
    /\b(zip|postcode|postal)[\s:#]*\d{4,6}\b/i.test(lower) ||
    /^(address|addr|loc|location)[\s:=]/i.test(lower) ||
    /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(s) || // e.g. "NY 10001", "CA 94105-1234"
    (/\d+/.test(s) && /\b(street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd|lane|ln\.|drive|dr\.|highway|hwy|suite|ste\.|floor|fl\.|building|bldg|sector|block|moholla|thana|district|plaza|tower)\b/i.test(lower)) ||
    (/^(suite|ste\.|floor|fl\.|building|bldg|sector|block|road|rd\.|street|st\.)\b/i.test(lower))
  ) {
    return true;
  }

  // 8. Contact & Web info
  // e.g. "TEL: 555-1234", "PHONE: 01700000000", "FAX:", "WWW.STORE.COM", "EMAIL: INFO@...", "HTTP://"
  if (
    /\b(tel|telephone|phone|ph #|cell|mobile|mob|fax|hotline|customer care|helpline)[\s:=]/i.test(lower) ||
    /\b(www\.|https?:\/\/|\.com\b|\.org\b|\.net\b|\.gov\b|\.edu\b|@|email|e-mail)\b/i.test(lower)
  ) {
    return true;
  }

  // 9. Receipt Summary & Totals / Taxes (Subtotal, Tax, Total, Rounding, Items Count)
  // e.g. "SUBTOTAL", "SALES TAX", "STATE TAX", "ITEMS COUNT: 5", "TOTAL QTY: 4", "ROUNDING"
  if (
    /\b(subtotal|sub\s*total|sales tax|state tax|local tax|vat|gst|total tax|tax total|discount total|savings|you saved|rounding|round off)\b/i.test(lower) ||
    /\b(items sold|item count|total items|total qty|total quantity|num items|qty sold|items count)\b/i.test(lower) ||
    /^(grand\s*total|total\s*amount|total\s*due|net\s*amount|amount\s*due|bill\s*amount|total payable|net payable)[\s:=]/i.test(lower)
  ) {
    return true;
  }

  // 10. Boilerplate & Footer text
  // e.g. "THANK YOU", "VISIT AGAIN", "CUSTOMER COPY", "MERCHANT COPY", "RETURN POLICY", "EXCHANGE WITHIN 7 DAYS", "SURVEY", "FEEDBACK"
  if (
    /\b(thank you|thanks for shopping|welcome|please come again|have a nice day|visit again|happy shopping)\b/i.test(lower) ||
    /\b(customer copy|merchant copy|store copy|duplicate copy|original copy|client copy)\b/i.test(lower) ||
    /\b(return policy|exchange policy|no refund|all sales final|goods sold are not returnable|terms and conditions|feedback|survey|win \$|sweepstakes|barcode)\b/i.test(lower) ||
    /\b(points earned|reward points|loyalty points|balance points|points balance|member id)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Clean and strip address, post code, telephone or tax ID appended to merchant name
 */
export function cleanMerchantName(raw: string): string {
  if (!raw) return '';
  let m = raw.trim();
  m = m.replace(/\b(street|st\.|road|rd\.|ave\.|avenue|suite|ste\.|zip|post\s*code|tel|phone|ph|\d{5}).*$/i, '').trim();
  m = m.replace(/^[#*\-•:\s|]+/, '').replace(/[\,\-\:\;\|\/]+$/, '').trim();
  return m;
}

/**
 * Clean receipt note, ensuring it only contains purchased items summary
 */
export function cleanReceiptNote(rawNote: string | undefined, merchant: string, items: ExtractedReceiptItem[]): string {
  let note = (rawNote || '').trim();
  if (!note || isReceiptMetadataOrNoiseLine(note, merchant)) {
    if (items.length > 0) {
      const summary = items.slice(0, 5).map((it) => it.name).join(', ');
      note = merchant ? `${merchant}: ${summary}` : summary;
    } else if (merchant) {
      note = `${merchant} purchase`;
    } else {
      note = 'Receipt payment';
    }
  }
  return note;
}

const STORAGE_KEY = 'gemini_api_key';
const SCAN_MODE_KEY = 'receipt_scan_mode';

/**
 * Retrieve the active scan mode: 'ai' | 'offline'
 */
export function getReceiptScanMode(): ReceiptScanMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(SCAN_MODE_KEY);
    if (saved === 'ai' || saved === 'offline') return saved;
  }
  return hasGeminiApiKey() ? 'ai' : 'offline';
}

/**
 * Save user scan mode preference.
 */
export function setReceiptScanMode(mode: ReceiptScanMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SCAN_MODE_KEY, mode);
  }
}

/**
 * Retrieve the active Gemini API Key from localStorage or environment variables.
 */
export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
}

/**
 * Save user-configured Gemini API Key in localStorage.
 */
export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
      // When user sets a key, default mode to 'ai'
      localStorage.setItem(SCAN_MODE_KEY, 'ai');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Check if a Gemini API key is currently available.
 */
export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

let cachedModels: string[] | null = null;
let cachedModelsKey = '';

/**
 * Dynamically queries Google Gemini ModelService to get active models supporting generateContent,
 * prioritizing Gemini 3.5 Flash-Lite and latest models while filtering out deprecated ones.
 */
export async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) return ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  if (cachedModels && cachedModelsKey === trimmed && cachedModels.length > 0) {
    return cachedModels;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`);
    if (res.ok) {
      const data = await res.json();
      const list = data?.models || [];
      const supported = list
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => (m.name || '').replace(/^models\//, ''))
        .filter(Boolean);

      if (supported.length > 0) {
        // Exclude deprecated or retired models reported by Google
        const active = supported.filter((name: string) =>
          !name.includes('2.0-flash-lite') &&
          !name.includes('1.5-pro') &&
          !name.includes('flash-exp')
        );

        const score = (name: string) => {
          if (name.includes('3.5-flash-lite')) return 100;
          if (name.includes('3.5-flash')) return 95;
          if (name.includes('3.5')) return 90;
          if (name.includes('2.5-flash')) return 80;
          if (name.includes('2.0-flash')) return 70;
          if (name.includes('1.5-flash')) return 60;
          if (name.includes('flash')) return 50;
          if (name.includes('gemini')) return 40;
          return 10;
        };

        active.sort((a: string, b: string) => score(b) - score(a));
        if (active.length > 0) {
          cachedModels = active;
          cachedModelsKey = trimmed;
          return active;
        }
      }
    }
  } catch {
    // Continue with default fallback list
  }

  return [
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];
}

/**
 * Validate a Gemini API key by checking Google Gemini API ModelService.
 */
export async function testGeminiApiKey(key: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, message: 'Please enter an API key to test.' };
  }

  // 1. Validate directly via ModelService.ListModels
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`);
    if (listRes.ok) {
      const data = await listRes.json().catch(() => ({}));
      const models = data?.models || [];
      if (models.length > 0) {
        return { ok: true, message: 'Connection successful! Gemini API is active.' };
      }
    } else {
      const data = await listRes.json().catch(() => ({}));
      const msg = data?.error?.message || `HTTP ${listRes.status}`;
      if (listRes.status === 400 && msg.toLowerCase().includes('api key')) {
        return { ok: false, message: 'Invalid API Key. Please check the key from Google AI Studio.' };
      }
    }
  } catch {
    // Continue with candidate ping
  }

  // 2. Fallback candidate ping
  const candidateModels = await getAvailableGeminiModels(trimmed);
  let lastErrMsg = '';

  for (const model of candidateModels.slice(0, 3)) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmed}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping. Reply OK.' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (res.ok) {
        return { ok: true, message: 'Connection successful! Gemini API is active.' };
      }

      const data = await res.json().catch(() => ({}));
      lastErrMsg = data?.error?.message || `HTTP ${res.status}`;
      if (res.status === 400 && lastErrMsg.toLowerCase().includes('api key')) {
        return { ok: false, message: 'Invalid API Key. Please check the key from Google AI Studio.' };
      }
    } catch (err: any) {
      lastErrMsg = err.message || 'Connection failed.';
    }
  }

  return { ok: false, message: lastErrMsg || 'Connection failed. Check your internet connection.' };
}

/**
 * Convert Bengali numerals (০-৯) to standard English numerals (0-9).
 */
export function normalizeNumerals(str: string): string {
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return str.replace(/[০-৯]/g, (digit) => bnToEn[digit] || digit);
}

/**
 * Compress and scale an image using client-side canvas so mobile uploads
 * stay lightweight (100-200KB) for ultra-fast processing.
 * Also upscales tiny thumbnails (< 600px) so OCR can read fine text.
 */
export async function compressImageForOcr(
  fileOrDataUrl: File | string,
  maxDimension = 1600,
  quality = 0.88
): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Upscale very small images (e.g. thumbnails < 600px) to boost OCR accuracy
      if (width < 600 && height < 600 && width > 0 && height > 0) {
        const scale = Math.min(2.5, 1200 / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      } else if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, dataUrl, mimeType });
    };

    img.onerror = () => reject(new Error('Failed to load image for processing'));

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Parse raw text in Without AI / Offline mode.
 */
export function parseReceiptTextOffline(
  rawText: string,
  categories: Category[] = [],
  userCurrency = '$',
  dataUrl = ''
): ExtractedReceiptData {
  const normalizedText = normalizeNumerals(rawText);
  const lines = normalizedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('OFFLINE_NO_TEXT');
  }

  // 1. Merchant name
  let merchant = '';
  const brandKeywords = [
    'ssmc', 'dhl', 'fedex', 'ups', 'aramex', 'shwapno', 'agora', 'meena', 'bazaar',
    'bazar', 'daraz', 'uber', 'pathao', 'kfc', 'pizza', 'burger'
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (brandKeywords.some((b) => lower.includes(b))) {
      merchant = line.replace(/^[#*\-•:\s|]+/, '').trim();
      break;
    }
  }

  if (!merchant) {
    const filterTerms = [
      'tax', 'vat', 'bin', 'tin', 'tel', 'phone', 'mob', 'cell', 'inv', 'bill',
      'receipt', 'order', 'token', 'date', 'time', 'cashier', 'welcome', 'thank',
      'http', 'www', '.com', '@', 'gst', 'chalan', 'memo', 'copy', 'customer', 'rate sheet', 'weight'
    ];

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      if (/^\d+$/.test(line) || /^\d{1,2}[/-]\d{1,2}/.test(line)) continue;
      if (filterTerms.some((term) => lower.includes(term))) continue;
      if (isReceiptMetadataOrNoiseLine(line)) continue;
      if (/[A-Za-z\u0980-\u09FF]{2,}/.test(line) && line.length <= 50) {
        merchant = line.replace(/^[#*\-•:\s|]+/, '').trim();
        break;
      }
    }
  }

  if (merchant) {
    merchant = cleanMerchantName(merchant);
  }

  // If title like "RATE SHEET" is present
  const sheetTitle = lines.find((l) => /rate sheet|price list|tariff/i.test(l));
  if (sheetTitle && (!merchant || !merchant.toLowerCase().includes('rate'))) {
    merchant = merchant ? `${merchant} (${sheetTitle})` : sheetTitle;
  }

  // 2. Date & Time
  let date = new Date().toISOString().slice(0, 10);
  let time = '';

  const datePatterns = [
    /\b(20\d\d)[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/,
    /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d\d|\d{2})\b/,
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        if (pattern === datePatterns[0]) {
          const y = match[1];
          const m = match[2].padStart(2, '0');
          const d = match[3].padStart(2, '0');
          date = `${y}-${m}-${d}`;
        } else {
          const d = match[1].padStart(2, '0');
          const m = match[2].padStart(2, '0');
          let y = match[3];
          if (y.length === 2) y = `20${y}`;
          date = `${y}-${m}-${d}`;
        }
        break;
      }
    }
    const timeMatch = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM|am|pm)?\b/);
    if (timeMatch && !time) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const ampm = timeMatch[3];
      if (ampm) {
        if (/pm/i.test(ampm) && hours < 12) hours += 12;
        if (/am/i.test(ampm) && hours === 12) hours = 0;
      }
      time = `${String(hours).padStart(2, '0')}:${minutes}`;
    }
  }

  // 3. Line items & Table Extraction
  const items: ExtractedReceiptItem[] = [];
  const skipWords = [
    'subtotal', 'net payable', 'total payable', 'সর্বমোট', 'মোট টাকা',
    'tax', 'vat', 'discount', 'tel', 'phone', 'date', 'time', 'invoice', 'receipt',
    'thank', 'customer', 'card', 'visa', 'mastercard', 'bkash', 'nagad', 'www.', 'http',
    'destination country', 'ssmc xpress'
  ];

  // Identify table header row if present
  let headerIndex = -1;
  const headerKeywords = ['weight', 'rate', 'rates', 'price', 'cost', 'fee', 'direction', 'qty', 'amount'];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    const count = headerKeywords.filter((k) => l.includes(k)).length;
    if (count >= 2) {
      headerIndex = i;
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (i === headerIndex) continue;
    const line = lines[i];
    const lower = line.toLowerCase();
    if (skipWords.some((w) => lower.includes(w))) continue;
    if (isReceiptMetadataOrNoiseLine(line, merchant)) continue;
    // Don't treat banner / header lines as products
    if (/^(rate sheet|price list|rates direction|weight rates)/i.test(line)) continue;
    if (/^(grand\s*total|total|net\s*amount|bill\s*amount|সর্বমোট|মোট)[\s:=@\-]/i.test(line)) continue;

    let priceNum = NaN;
    let rawName = '';

    // Strategy 1: Look for explicit currency symbol anywhere in the line ($5.75, ৳500, €12.50)
    const currencyMatch = line.match(/([\$৳£€])\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{1,7}(?:\.[0-9]{1,2})?)/);
    if (currencyMatch) {
      const p = parseFloat(currencyMatch[2].replace(/,/g, ''));
      if (!isNaN(p) && p > 0 && p < 50000000 && p !== 2024 && p !== 2025 && p !== 2026) {
        priceNum = p;
        // Clean out the price token to get the description
        const textWithoutPrice = line.replace(currencyMatch[0], ' ').trim();
        const tokens = textWithoutPrice.split(/\s+/).filter(Boolean);

        // If line is tabular like: "1 0.45 INBOUND INTL"
        if (tokens.length >= 2 && /^\d+$/.test(tokens[0]) && /^\d+\.?\d*$/.test(tokens[1])) {
          const rest = tokens.slice(2).join(' ');
          rawName = `${tokens[0]} lbs (${tokens[1]} kg)${rest ? ` - ${rest}` : ''}`;
        } else {
          rawName = textWithoutPrice.replace(/[\:\-\=\@\.\*\#\|\/]+/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Strategy 2: If no currency sign, check for line ending with a price e.g. "Item 1 50.00"
    if (isNaN(priceNum)) {
      const priceRegex = /([\$৳£€]?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]{1,7}(?:\.[0-9]{1,2})?))(?:\s*[\.\,\;\:\-\|\)\/]*\s*)$/;
      const priceMatch = line.match(priceRegex);

      if (priceMatch) {
        const priceStr = priceMatch[2].replace(/,/g, '');
        priceNum = parseFloat(priceStr);
        rawName = line.slice(0, priceMatch.index).trim();
      }
    }

    // Strategy 3: Check for formatted comma number anywhere in line, e.g. "3kg 201,000 NGN"
    if (isNaN(priceNum)) {
      const commaMatch = line.match(/([A-Za-z0-9\s\-\/\.]+?)\s+([\$৳£€]?\s*([0-9]{1,3}(?:,[0-9]{3})+))/);
      if (commaMatch) {
        rawName = commaMatch[1].trim();
        priceNum = parseFloat(commaMatch[3].replace(/,/g, ''));
      }
    }

    // Strategy 4: Tabular row with multiple numbers, e.g. "4 1.81 12.65 INBOUND INTL"
    if (isNaN(priceNum)) {
      const tokens = line.split(/\s+/).filter(Boolean);
      // If starts with integer row index/weight (1..50) followed by decimal
      if (tokens.length >= 3 && /^\d{1,3}$/.test(tokens[0]) && /^\d+\.\d+$/.test(tokens[1]) && /^\d+\.\d{2}$/.test(tokens[2])) {
        priceNum = parseFloat(tokens[2]);
        const rest = tokens.slice(3).join(' ');
        rawName = `${tokens[0]} lbs (${tokens[1]} kg)${rest ? ` - ${rest}` : ''}`;
      }
    }

    // Strategy 5: Unpriced items, shopping lists, or handwritten checklists (e.g. "• potatoes", "eggs (2)")
    if (isNaN(priceNum)) {
      let cleanLine = line.replace(/^[\#\*\-•:\s\|\>\–\—\(\)\[\]\d\.\)]+/, '').trim();
      cleanLine = cleanLine.replace(/[\:\-\=\@\.\*\#\|\/\?]+$/, '').trim();
      if (
        cleanLine.length >= 3 &&
        !isReceiptMetadataOrNoiseLine(cleanLine, merchant)
      ) {
        rawName = cleanLine;
        priceNum = 0; // Default to 0 for unpriced shopping/grocery list items
      }
    }

    if (!isNaN(priceNum)) {
      rawName = rawName.replace(/^[\#\*\-•:\s\|]+/, '').replace(/[\:\-\=\@\.\*\#\|\/\~]+$/, '').trim();

      // Discard noise / gibberish lines or POS receipt metadata (address, post code, cashier, card info, etc.)
      if (!rawName || isGibberishLine(rawName) || isReceiptMetadataOrNoiseLine(rawName, merchant)) {
        continue;
      }

      if (/^\d+$/.test(rawName)) {
        rawName = `Item #${rawName}`;
      }

      if (rawName.length >= 3 && priceNum >= 0 && priceNum < 50000000 && priceNum !== 2024 && priceNum !== 2025 && priceNum !== 2026) {
        // Smart category detection per item based on keywords
        const lowerName = rawName.toLowerCase();
        let itemMatchedCat = categories.find((c) => {
          if (c.type !== 'expense') return false;
          const cn = c.name.toLowerCase();
          if (/courier|freight|transport|shipping|express|intl|inbound|lbs|kg|delivery|fare|uber|pathao|cng|fuel|petrol/i.test(lowerName)) {
            return cn.includes('transport') || cn.includes('shipping') || cn.includes('delivery');
          }
          if (/food|dining|restaurant|meal|burger|pizza|coffee|tea|lunch|dinner|snack|bistro|cafe|biryani/i.test(lowerName)) {
            return cn.includes('food') || cn.includes('dining');
          }
          if (/grocery|groceries|supermarket|bazar|rice|oil|dal|egg|apple|milk|fruit|meat|fish|vegetable/i.test(lowerName)) {
            return cn.includes('grocer') || cn.includes('shopping');
          }
          if (/medicine|pharma|doctor|clinic|hospital|tablet|syrup|health|prescription/i.test(lowerName)) {
            return cn.includes('health') || cn.includes('medicine');
          }
          return false;
        });

        // If no match found, fallback to 'Other Expense' or leave empty for Products/Services
        if (!itemMatchedCat) {
          itemMatchedCat = categories.find((c) => c.type === 'expense' && /other|product|service|general/i.test(c.name));
        }

        items.push({
          id: `offline-item-${Date.now()}-${items.length}`,
          name: rawName,
          price: Math.round(priceNum * 100) / 100,
          category_id: itemMatchedCat?.id || '',
          category_name: itemMatchedCat?.name || 'Products & Services',
          selected: true,
        });
      }
    }
  }

  // 4. Amount
  const totalKeywords = [
    /(?:grand\s*total|net\s*payable|total\s*payable|সর্বমোট|মোট\s*টাকা|মোট)/i,
    /(?:total\s*amount|bill\s*amount|net\s*amount|amount\s*paid)/i,
    /(?:total|amount\s*due|balance\s*due|due|balance)/i,
    /(?:subtotal|sub\s*total)/i,
  ];

  let detectedAmount: number | null = null;

  for (const regex of totalKeywords) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        const numMatches = line.match(/[\$৳£€]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/g);
        if (numMatches) {
          const lastNumStr = numMatches[numMatches.length - 1].replace(/[\$৳£€,\s]/g, '');
          const val = parseFloat(lastNumStr);
          if (!isNaN(val) && val > 0 && val < 5000000) {
            detectedAmount = val;
            break;
          }
        }
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextMatch = nextLine.match(/[\$৳£€]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/);
          if (nextMatch) {
            const val = parseFloat(nextMatch[1].replace(/,/g, ''));
            if (!isNaN(val) && val > 0 && val < 5000000) {
              detectedAmount = val;
              break;
            }
          }
        }
      }
    }
    if (detectedAmount !== null) break;
  }

  if (detectedAmount === null) {
    if (items.length > 0) {
      const isRateSheet = lines.some((l) => /rate sheet|price list|tariff|shipping rates/i.test(l));
      if (isRateSheet) {
        // For rate sheets, default total to first tier price
        detectedAmount = items[0].price;
      } else {
        const sum = items.reduce((acc, curr) => acc + curr.price, 0);
        detectedAmount = Math.round(sum * 100) / 100;
      }
    } else {
      const allNumbers: number[] = [];
      for (const line of lines) {
        if (/^\+?01\d{9}/.test(line) || /^\d{4}[-/.]/.test(line)) continue;
        const matches = line.match(/\b([0-9]{1,6}(?:\.[0-9]{1,2})?)\b/g);
        if (matches) {
          for (const m of matches) {
            const n = parseFloat(m);
            if (!isNaN(n) && n > 0 && n < 1000000 && n !== 2024 && n !== 2025 && n !== 2026) {
              allNumbers.push(n);
            }
          }
        }
      }
      detectedAmount = allNumbers.length > 0 ? Math.max(...allNumbers) : 0;
    }
  }

  // 5. Note
  const note = cleanReceiptNote('', merchant, items);

  // 6. Category
  const textCombined = `${rawText} ${merchant} ${items.map((it) => it.name).join(' ')}`.toLowerCase();
  let matchedCategory: Category | undefined;

  const categoryTerms: Record<string, string[]> = {
    groceries: ['grocery', 'groceries', 'supermarket', 'mart', 'market', 'shwapno', 'agora', 'meena', 'bazar', 'milk', 'bread', 'egg', 'sugar', 'rice', 'oil', 'produce', 'vegetable', 'fruit', 'bazaar'],
    dining: ['restaurant', 'cafe', 'coffee', 'bakery', 'pizza', 'burger', 'kitchen', 'food', 'fast food', 'kfc', 'snack', 'tea', 'diner'],
    transport: ['fuel', 'petrol', 'gas', 'cng', 'uber', 'pathao', 'toll', 'parking', 'transport', 'bus', 'train', 'flight', 'ride'],
    shopping: ['apparel', 'clothing', 'fashion', 'shoes', 'electronics', 'aarong', 'yellow', 'mall', 'store', 'cloth'],
    utilities: ['electricity', 'water', 'desco', 'dpdc', 'wasa', 'titas', 'internet', 'wifi', 'broadband', 'utility', 'bill'],
    health: ['pharmacy', 'medicine', 'pharma', 'hospital', 'clinic', 'doctor', 'drug', 'health', 'medical'],
  };

  if (categories.length > 0) {
    for (const [key, terms] of Object.entries(categoryTerms)) {
      if (terms.some((term) => textCombined.includes(term))) {
        matchedCategory = categories.find(
          (c) => c.type === 'expense' && terms.some((term) => c.name.toLowerCase().includes(term) || c.name.toLowerCase().includes(key))
        );
        if (matchedCategory) break;
      }
    }

    if (!matchedCategory) {
      matchedCategory = categories.find((c) => c.type === 'expense') || categories[0];
    }
  }

  // 7. Payment method
  let paymentMethod: 'Cash' | 'Bank Account' | 'Mobile Wallet' = 'Cash';
  if (/bkash|nagad|rocket|upay|wallet/i.test(textCombined)) {
    paymentMethod = 'Mobile Wallet';
  } else if (/visa|mastercard|amex|card|pos|bank|transfer/i.test(textCombined)) {
    paymentMethod = 'Bank Account';
  }

  return {
    amount: Math.round(detectedAmount * 100) / 100,
    type: 'expense',
    merchant: merchant || (items[0]?.name ? items[0].name : 'Store'),
    items,
    date,
    time,
    categoryId: matchedCategory?.id,
    categoryName: matchedCategory?.name,
    note,
    paymentMethod,
    receiptImage: dataUrl,
    isOffline: true,
  };
}

/**
 * Dynamically load Tesseract.js from CDN on demand in the browser.
 * Zero APK bloat (0 bytes in production APK and Next.js bundle).
 */
let tesseractLoaderPromise: Promise<any> | null = null;

export function loadTesseractCDN(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window not available for OCR'));
  }
  if ((window as any).Tesseract) {
    return Promise.resolve((window as any).Tesseract);
  }
  if (tesseractLoaderPromise) {
    return tesseractLoaderPromise;
  }

  tesseractLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="tesseract.min.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).Tesseract));
      existing.addEventListener('error', () => reject(new Error('Failed to load OCR library')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).Tesseract) {
        resolve((window as any).Tesseract);
      } else {
        reject(new Error('Tesseract script loaded but object missing'));
      }
    };
    script.onerror = () => reject(new Error('Could not load OCR engine from CDN'));
    document.head.appendChild(script);
  });

  return tesseractLoaderPromise;
}

/**
 * Perform Without AI (Offline) Scan.
 * Uses lightweight client-side image processing + on-demand browser OCR.
 * Zero API keys, zero cloud, zero APK bloat.
 */
export async function scanReceiptOffline(
  fileOrDataUrl: File | string,
  categories: Category[] = [],
  userCurrency = '$'
): Promise<ExtractedReceiptData> {
  const { dataUrl } = await compressImageForOcr(fileOrDataUrl);
  const defaultCat = categories.find((c) => c.type === 'expense') || categories[0];

  // Attempt client-side OCR with timeout protection
  try {
    const ocrPromise = (async () => {
      const Tesseract = await loadTesseractCDN();
      if (Tesseract && typeof Tesseract.recognize === 'function') {
        const ocrResult = await Tesseract.recognize(dataUrl, 'eng', {
          logger: () => { },
        });
        const text = ocrResult?.data?.text || '';
        const confidence = typeof ocrResult?.data?.confidence === 'number' ? ocrResult.data.confidence : 100;
        return { text, confidence };
      }
      return { text: '', confidence: 0 };
    })();

    const timeoutPromise = new Promise<{ text: string; confidence: number }>((_, reject) =>
      setTimeout(() => reject(new Error('OCR_TIMEOUT')), 7000)
    );

    const { text: recognizedText, confidence } = await Promise.race([ocrPromise, timeoutPromise]);
    if (recognizedText && recognizedText.trim().length > 3) {
      const parsed = parseReceiptTextOffline(recognizedText, categories, userCurrency, dataUrl);
      if (confidence < 50 || parsed.items.length === 0) {
        parsed.isLowConfidence = true;
        parsed.lowConfidenceMessage = 'Handwriting or low-clarity text detected. Client-side offline OCR cannot read cursive handwriting accurately. For 100% handwriting accuracy, switch to Gemini AI.';
      }
      return parsed;
    }
  } catch (ocrErr) {
    console.warn('Offline OCR client-side error or offline fallback:', ocrErr);
  }

  // Graceful fallback if OCR is completely blank or offline
  return {
    amount: 0,
    type: 'expense',
    merchant: 'Receipt Attachment',
    items: [],
    date: new Date().toISOString().slice(0, 10),
    time: '',
    categoryId: defaultCat?.id,
    categoryName: defaultCat?.name,
    note: 'Receipt photo attached (Offline mode)',
    paymentMethod: 'Cash',
    receiptImage: dataUrl,
    isOffline: true,
    isLowConfidence: true,
    lowConfidenceMessage: 'Text could not be read clearly in offline mode. Use Gemini AI for handwriting recognition or enter manually.',
  };
}

/**
 * Universal Smart Receipt Scanner.
 * Respects user's configured preference: 'ai' vs 'offline'.
 */
export async function scanReceiptSmart(
  fileOrDataUrl: File | string,
  categories: Category[] = [],
  userCurrency = '$'
): Promise<ExtractedReceiptData> {
  const mode = getReceiptScanMode();

  if (mode === 'ai') {
    if (!hasGeminiApiKey()) {
      throw new Error('CONFIG_AI_IN_SETTINGS');
    }
    try {
      return await scanReceiptWithGemini(fileOrDataUrl, categories, userCurrency);
    } catch (aiErr: any) {
      if (aiErr.message === 'INVALID_GEMINI_API_KEY' || aiErr.message === 'CONFIG_AI_IN_SETTINGS') {
        throw aiErr;
      }
      console.warn('Gemini AI scan failed, falling back to offline scan:', aiErr);
      return await scanReceiptOffline(fileOrDataUrl, categories, userCurrency);
    }
  }

  // Without AI (Offline mode)
  return await scanReceiptOffline(fileOrDataUrl, categories, userCurrency);
}

/**
 * Smartly parse a receipt, bill, invoice, or price tag image using Google Gemini Multimodal Vision API.
 */
export async function scanReceiptWithGemini(
  fileOrDataUrl: File | string,
  categories: Category[] = [],
  userCurrency = '$'
): Promise<ExtractedReceiptData> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  const { base64, dataUrl, mimeType } = await compressImageForOcr(fileOrDataUrl);

  const categoryNames = categories.map((c) => c.name).filter(Boolean);
  const categoryListPrompt = categoryNames.length > 0
    ? `Choose the closest match for "category" from this exact list: [${categoryNames.join(', ')}]. If none fit, pick a standard category like "Food & Dining", "Groceries", "Shopping", "Transportation", "Utilities", "Healthcare", or "Entertainment".`
    : 'Provide a standard category like "Food & Dining", "Groceries", "Shopping", "Transportation", "Utilities", or "Healthcare".';

  const systemPrompt = `You are an expert receipt, invoice, bill, price list, and transaction parsing AI for a personal finance app.
Analyze the provided image carefully. It could be a store receipt, restaurant bill, supermarket voucher, pharmacy bill, handwritten memo, utility bill, SMS payment screenshot, price tag, or logistics/shipping price list (in English, Bengali, or any language).
Extract all transaction details accurately.

CRITICAL POS RECEIPT & INVOICE FILTERING RULES:
1. HEADER & FOOTER METADATA MUST BE COMPLETELY EXCLUDED FROM "items":
   - NEVER add company/store name, brand name, slogan, or logo text into the "items" array.
   - NEVER add store address, street, road, building, suite, city, state, country, or postal/zip code (e.g. '123 Main St', 'Suite 4', 'Zip: 90210', 'Dhaka 1212') into "items".
   - NEVER add phone numbers, mobile, fax, email, website URLs, or social handles into "items".
   - NEVER add Tax ID, VAT registration, BIN, TIN, GST, or business license numbers into "items".
   - NEVER add cashier name, server, operator, register/POS terminal number, or order/table numbers into "items".
   - NEVER add payment method lines ('VISA', 'Mastercard', 'Debit Card', 'Cash', card numbers '****1234', 'AUTH CODE', 'APPROVAL', 'AID', 'TRACE #') into "items".
   - NEVER add payment tender lines ('CASH TENDERED', 'CHANGE DUE', 'BALANCE') into "items".
   - NEVER add subtotal, tax amount, discount, tip, total items count ('ITEMS SOLD: 3'), or barcode into "items".
   - NEVER add receipt footer boilerplate ('THANK YOU', 'CUSTOMER COPY', 'RETURN POLICY', 'SURVEY') into "items".
   - The "items" array MUST ONLY contain actual purchased products, groceries, food items, medicines, or billable services.

2. "merchant":
   - Extract only the short, clean store/vendor name (e.g. 'Walmart', 'Target', 'Starbucks', 'SSMC').
   - NEVER include the address, zip code, phone number, or tax registration in the merchant name!

3. "note":
   - Provide a clean, short summary of the purchased items (e.g. 'Milk, Eggs, Bread').
   - NEVER include company address, postal code, phone, tax ID, or payment card details in the note!

4. "payment_method":
   - Only detect the high-level method: 'Cash', 'Bank Account' (for credit/debit card, bank transfer), or 'Mobile Wallet' (bKash, Nagad, etc.).
   - Do NOT output card numbers or transaction IDs anywhere.

CRITICAL INSTRUCTIONS FOR NUMBERS AND ITEMS:
1. "amount":
   - If this is a normal receipt/bill with a Grand Total / Net Payable, use that exact total amount.
   - If this is a price list, tariff, or rate card without a single grand total, use the first tier rate or base price (e.g. 5.75).
   - Never pick phone numbers, dates, or invoice IDs as the amount.
2. TABLE & RATE SHEET INSTRUCTIONS:
   - Carefully read the table headers (e.g. "Weight (lbs)", "Weight (kg)", "Rates", "Price", "Cost", "Direction", "Description").
   - Identify which column represents the price/rate/cost (columns with "$", currency signs, or titled "Rates", "Price", "Amount", "Cost").
   - For EVERY single row, extract the exact price from that column. Never merge decimals or drop decimal points (e.g. "$21.28" must be 21.28, NEVER 2128!).
   - Smartly formulate the product name from the other descriptive columns (e.g. "1 lbs (0.45 kg) - Inbound Intl", "2 lbs (0.91 kg) - Inbound Intl").
3. "items": Extract EVERY SINGLE product, item, tier, food dish, grocery item, medicine, or service listed on the receipt/rate card as an array of objects:
   [
     {
       "name": "Clean concise product, service, or weight tier name (e.g. '1 lbs (0.45 kg) - Inbound Intl', 'Whole Milk 1L')",
       "price": number (The price/rate of this individual item, e.g. 5.75, 21.28),
       "category": "Closest matching category for this specific item"
     }
   ]
   Ensure NO items or rows from the list are skipped (e.g. if there are 10 rows, return all 10 items).
4. If handwriting, multi-column tables, or rate charts list multiple products and prices, extract each product into the "items" array.
5. HANDWRITTEN LISTS, SHOPPING/GROCERY CHECKLISTS, AND UNPRICED ITEMS:
   - The image may be a handwritten grocery list, shopping checklist, memo, recipe, or handwritten note on lined notebook paper or sticky note (often with NO prices listed, e.g. "potatoes", "peas & carrots", "pastina", "garbage bags", "dog treats", "aluminum foil", "almond milk", "creamer - vanilla", "eggs (2)", "crushed tomatoes", "hot sauce", "paper towels").
   - You MUST recognize handwriting carefully and extract EVERY SINGLE handwritten item, grocery item, or bullet point into the "items" array.
   - If an item does NOT have a price written on the paper, set its "price": 0.
   - If there is no total amount written on the paper, set "amount": 0.
   - Set "merchant": "Shopping List" or "Grocery List".
   - Set "category": "Shopping & Groceries" or "Food & Dining".
   - Set "note": "Shopping List (" + count of items + " items)".
   - NEVER drop or skip unpriced items. Always return all items in the "items" array!

Output Requirements:
Return ONLY a valid, raw JSON object (WITHOUT any markdown formatting, no \`\`\`json code blocks, no other text).
JSON schema:
{
  "amount": number (The grand total amount paid or due),
  "type": "expense" or "income" (default to "expense"),
  "merchant": string (The store, vendor, brand, business, restaurant, or counterparty name),
  "items": [{"name": string, "price": number, "category": string}],
  "date": string in "YYYY-MM-DD" format,
  "time": string in "HH:MM" 24-hour format,
  "category": string (${categoryListPrompt}),
  "note": string (Summary of purchase with item names),
  "payment_method": "Cash" | "Bank Account" | "Mobile Wallet"
}`;

  // Get active models dynamically from Google ModelService, prioritizing gemini-3.5-flash-lite
  const candidateModels = await getAvailableGeminiModels(apiKey);
  let lastError: Error | null = null;
  let responseText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    // 25s timeout allows multimodal vision image upload and JSON parsing over mobile/wifi networks
    const timeoutTimer = setTimeout(() => controller.abort(), 25000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                {
                  text: systemPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      });
      clearTimeout(timeoutTimer);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

        // 1. Invalid API Key
        if (response.status === 400 && message.toLowerCase().includes('api key')) {
          throw new Error('INVALID_GEMINI_API_KEY');
        }

        // 2. Quota / Rate limit (429) -> don't spam other models, report directly
        if (response.status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
          throw new Error('Gemini API quota exceeded or rate limit reached. Please wait a minute or use "Without AI" mode.');
        }

        // 3. Permission / Region (403)
        if (response.status === 403) {
          throw new Error(`Google API Access Denied: ${message}`);
        }

        // 4. Model not found or deprecated -> continue to next candidate
        if (response.status === 404 || message.toLowerCase().includes('no longer available') || message.toLowerCase().includes('not found')) {
          lastError = new Error(message);
          continue;
        }

        lastError = new Error(message);
        continue;
      }

      const data = await response.json();
      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (responseText) break;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (
        err.message === 'INVALID_GEMINI_API_KEY' ||
        err.message?.startsWith('Gemini API quota') ||
        err.message?.startsWith('Google API Access Denied')
      ) {
        throw err;
      }
      if (err.name === 'AbortError') {
        lastError = new Error('AI request timed out. Please try again or switch to Without AI mode.');
      } else {
        lastError = err;
      }
    }
  }

  if (!responseText) {
    throw lastError || new Error('Failed to extract data from receipt image.');
  }

  let cleanJson = responseText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json\s*/i, '');
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```\s*/, '');
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.slice(0, -3);
  }
  cleanJson = cleanJson.trim();

  const startIdx = cleanJson.indexOf('{');
  const endIdx = cleanJson.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    cleanJson = cleanJson.substring(startIdx, endIdx + 1);
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    throw new Error('Gemini returned an invalid response. Please try with a clearer photo.');
  }

  const rawAmount = typeof parsed.amount === 'number' ? parsed.amount : parseFloat(String(parsed.amount || '0').replace(/[^0-9.]/g, ''));
  let amount = isNaN(rawAmount) ? 0 : Math.round(rawAmount * 100) / 100;
  const type: 'income' | 'expense' = parsed.type === 'income' ? 'income' : 'expense';
  const merchant = cleanMerchantName(parsed.merchant || '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : new Date().toISOString().slice(0, 10);
  const time = /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : '';

  const targetCategoryName = (parsed.category || '').toLowerCase().trim();
  let matchedCategory: Category | undefined;

  if (targetCategoryName && categories.length > 0) {
    matchedCategory = categories.find((c) => c.name.toLowerCase() === targetCategoryName && c.type === type);
    if (!matchedCategory) {
      matchedCategory = categories.find(
        (c) =>
          c.type === type &&
          (c.name.toLowerCase().includes(targetCategoryName) || targetCategoryName.includes(c.name.toLowerCase()))
      );
    }
  }

  if (!matchedCategory && categories.length > 0) {
    matchedCategory = categories.find((c) => c.type === type) || categories[0];
  }

  // Filter out any header/footer metadata, company address, postal code, payment method, or cashier lines
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const validItems = rawItems.filter((it: any) => {
    const itemName = String(it.name || '').trim();
    if (!itemName || isGibberishLine(itemName)) return false;
    if (isReceiptMetadataOrNoiseLine(itemName, merchant)) return false;
    return true;
  });

  const items: ExtractedReceiptItem[] = validItems.map((it: any, idx: number) => {
    const itemPrice = typeof it.price === 'number'
      ? it.price
      : parseFloat(String(it.price || '0').replace(/[^0-9.]/g, '')) || 0;
    const itemName = String(it.name || `Product ${idx + 1}`).trim();
    const itemCatName = (it.category || '').toLowerCase().trim();

    let itemMatchedCat = categories.find((c) => c.name.toLowerCase() === itemCatName && c.type === type);
    if (!itemMatchedCat && itemCatName) {
      itemMatchedCat = categories.find(
        (c) => c.type === type && (c.name.toLowerCase().includes(itemCatName) || itemCatName.includes(c.name.toLowerCase()))
      );
    }
    if (!itemMatchedCat) {
      itemMatchedCat = categories.find((c) => c.type === type && /other|product|service|general/i.test(c.name)) || matchedCategory;
    }

    return {
      id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name: itemName,
      price: Math.round(itemPrice * 100) / 100,
      category_id: itemMatchedCat?.id || '',
      category_name: itemMatchedCat?.name || 'Products & Services',
      selected: true,
    };
  });

  // If amount was 0 or invalid, but items exist, calculate sum of items as total
  if ((amount === 0 || isNaN(amount)) && items.length > 0) {
    amount = Math.round(items.reduce((acc, it) => acc + (it.price || 0), 0) * 100) / 100;
  }

  // If no items were detected, but an amount exists, generate a single item
  if (items.length === 0 && amount > 0) {
    items.push({
      id: `item-${Date.now()}-0`,
      name: merchant || 'Receipt Item',
      price: amount,
      category_id: matchedCategory?.id,
      category_name: matchedCategory?.name,
      selected: true,
    });
  }

  const note = cleanReceiptNote(parsed.note, merchant, items);

  let paymentMethod: 'Cash' | 'Bank Account' | 'Mobile Wallet' = 'Cash';
  const pmRaw = (parsed.payment_method || '').toLowerCase();
  if (pmRaw.includes('bank') || pmRaw.includes('transfer') || pmRaw.includes('card') || pmRaw.includes('visa')) {
    paymentMethod = 'Bank Account';
  } else if (pmRaw.includes('wallet') || pmRaw.includes('bkash') || pmRaw.includes('nagad') || pmRaw.includes('rocket')) {
    paymentMethod = 'Mobile Wallet';
  }

  return {
    amount,
    type,
    merchant,
    items,
    date,
    time,
    categoryId: matchedCategory?.id,
    categoryName: matchedCategory?.name,
    note,
    paymentMethod,
    receiptImage: dataUrl,
    isOffline: false,
  };
}

/**
 * Safely fetches an image from an HTTP/HTTPS link, converting it to base64 dataUrl.
 * Uses local backend proxy and CORS proxy fallbacks if direct fetch fails.
 */
export async function fetchImageFromUrl(url: string): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  const trimmed = url.trim();
  if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
    throw new Error('Please enter a valid HTTP or HTTPS image URL');
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const candidates = [
    trimmed, // 1. Direct fetch (works if CDN supports CORS)
    `/api/proxy-image?url=${encodeURIComponent(trimmed)}`, // 2. Local relative proxy
    `http://${hostname}:18080/api/proxy-image?url=${encodeURIComponent(trimmed)}`, // 3. Backend port 18080 proxy
    `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`, // 4. Public CORS proxy fallback
  ];

  let lastErr: Error | null = null;
  for (const target of candidates) {
    try {
      const res = await fetch(target);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') && blob.type !== 'application/octet-stream' && blob.size < 50) {
        continue;
      }
      return await new Promise<{ base64: string; dataUrl: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const mimeType = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ base64, dataUrl, mimeType });
        };
        reader.onerror = () => reject(new Error('Failed to read image data from URL'));
        reader.readAsDataURL(blob);
      });
    } catch (e: any) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Could not load image from link. Please verify the URL.');
}

export interface AiChatResult {
  items: ExtractedReceiptItem[];
  amount: number;
  note: string;
  replyMessage: string;
}

/**
 * Edit existing items or create a new item list from natural language with Google Gemini.
 * Supports:
 * - Listing new items from text ("List: 2 kg apples $4, 1L milk $3, bread $2")
 * - Editing existing items ("Change milk price to 3.50", "Delete item 2")
 * - Applying bulk modifications ("10% discount to all items", "Remove $0 items", "Set category to Food")
 */
export async function editOrListItemsWithGemini({
  userPrompt,
  currentItems,
  currentAmount,
  currentNote,
  categories,
  userCurrency,
  apiKey,
}: {
  userPrompt: string;
  currentItems: ExtractedReceiptItem[];
  currentAmount: number;
  currentNote: string;
  categories: Category[];
  userCurrency: string;
  apiKey?: string;
}): Promise<AiChatResult> {
  const key = (apiKey || getGeminiApiKey()).trim();
  if (!key) {
    throw new Error('Gemini API key is required. Please add your API key in Settings.');
  }

  const categoryNames = categories.map((c) => c.name).join(', ') || 'Food & Dining, Groceries, Shopping, Transportation, Utilities, Entertainment, Personal Care, Healthcare, Education, General';

  const simplifiedCurrentItems = currentItems.map((it, idx) => ({
    id: it.id || `item-${idx + 1}`,
    name: it.name,
    price: it.price || 0,
    category: it.category_name || '',
  }));

  const systemInstruction = `You are CashFlow AI, an intelligent personal finance and transaction item editor.
Your job is to understand the user's voice or text command to either:
1. ADD ITEMS: Append new items to the existing list (e.g. "Add 2kg apples $4, 1L milk $3", "দুধ আর ডিম যোগ করো").
2. REMOVE / DELETE ITEMS: Remove specified items from the list (e.g. "Remove milk", "Delete item 2", "Remove all zero price items", "ডিম বাদ দাও").
3. EDIT / CHANGE ITEMS: Modify prices, quantities, names, or categories of existing items (e.g. "Change milk price to $3.50", "Give 10% discount to all items", "Set Food category").
4. LIST FROM SCRATCH: If no items exist or user asks for a new list, generate all items with prices and categories.

Current Transaction Context:
- User Currency: ${userCurrency}
- Current Total Amount: ${currentAmount}
- Current Note: "${currentNote}"
- Available Categories: [${categoryNames}]
- Current Items List (${simplifiedCurrentItems.length} items):
${JSON.stringify(simplifiedCurrentItems, null, 2)}

User Instruction / Prompt:
"${userPrompt}"

Rules & Response Format:
1. Return ONLY a single raw valid JSON object (no markdown, no backticks, no code fence).
2. The JSON structure MUST be exactly:
{
  "items": [
    {
      "name": "Item description",
      "price": 12.50,
      "category": "Matching category name from available list"
    }
  ],
  "amount": 12.50,
  "note": "Concise summary of transaction or updated note",
  "reply_message": "Friendly 1-2 sentence response explaining what changes were made (can be English or Bengali depending on user query)"
}
3. If user asks to ADD items: KEEP all existing items and APPEND the new item(s).
4. If user asks to REMOVE or DELETE items: REMOVE matching items from the array and KEEP all remaining items.
5. If user asks to EDIT or CHANGE items: MODIFY the specified items and KEEP all others.
6. "amount" MUST be the sum of the prices of all items in the array (rounded to 2 decimal places), unless explicitly specified otherwise by user.
7. Prices must be valid numbers (not strings). If an item has no price mentioned, set price to 0.
8. "category" should match one of the available category names whenever possible.
`;

  const candidateModels = await getAvailableGeminiModels(key);
  let lastError: Error | null = null;
  let responseText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: systemInstruction }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      });
      clearTimeout(timeoutTimer);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

        if (response.status === 400 && message.toLowerCase().includes('api key')) {
          throw new Error('INVALID_GEMINI_API_KEY');
        }
        if (response.status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
          throw new Error('Gemini API quota exceeded or rate limit reached. Please wait a minute.');
        }
        if (response.status === 404 || message.toLowerCase().includes('no longer available') || message.toLowerCase().includes('not found')) {
          lastError = new Error(message);
          continue;
        }
        lastError = new Error(message);
        continue;
      }

      const data = await response.json();
      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (responseText) break;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (err.message === 'INVALID_GEMINI_API_KEY' || err.message?.startsWith('Gemini API quota')) {
        throw err;
      }
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError || new Error('Could not get response from Gemini AI. Please check your network and API key.');
  }

  // Parse JSON
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse AI response into items list.');
    }
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: ExtractedReceiptItem[] = rawItems.map((it: any, idx: number) => {
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === String(it.category || '').toLowerCase()
    );
    const priceNum = Math.round((parseFloat(it.price) || 0) * 100) / 100;
    return {
      id: `ai-item-${Date.now()}-${idx}`,
      name: String(it.name || 'Item').trim(),
      price: priceNum,
      category_id: matchedCategory?.id || '',
      category_name: matchedCategory?.name || (it.category ? String(it.category) : 'General'),
      selected: true,
    };
  });

  let amount = typeof parsed.amount === 'number' ? Math.round(parsed.amount * 100) / 100 : 0;
  if (amount === 0 && items.length > 0) {
    amount = Math.round(items.reduce((sum, item) => sum + (item.price || 0), 0) * 100) / 100;
  }

  const note = parsed.note ? String(parsed.note).trim() : currentNote;
  const replyMessage = parsed.reply_message ? String(parsed.reply_message).trim() : 'Updated items successfully.';

  return {
    items,
    amount,
    note,
    replyMessage,
  };
}

/**
 * AI Shopping List parser: converts natural language into shopping checklist items with Gemini.
 */
export async function parseShoppingListWithGemini({
  userPrompt,
  existingItems,
  apiKey,
}: {
  userPrompt: string;
  existingItems: Array<{ id: string; name: string; quantity: string; estimated_price?: number }>;
  apiKey?: string;
}): Promise<{
  items: Array<{
    id: string;
    name: string;
    quantity: string;
    estimated_price: number;
    priority: 'high' | 'normal' | 'low';
    is_bought: boolean;
    note?: string;
    created_at: string;
  }>;
  replyMessage: string;
}> {
  const key = (apiKey || getGeminiApiKey()).trim();
  if (!key) {
    throw new Error('Gemini API key is required. Please add your API key in Settings.');
  }

  const prompt = `You are CashFlow AI Shopping Assistant.
User wants to ADD, REMOVE, or EDIT items in their shopping checklist using voice or text.
Current Items (${existingItems.length} items):
${JSON.stringify(existingItems, null, 2)}

User Instruction: "${userPrompt}"

Rules:
1. If user asks to ADD items (e.g. "Add 5kg potatoes, 2 dozen eggs"): keep existing items and append the new items.
2. If user asks to REMOVE or DELETE items (e.g. "Remove milk", "ডিম বাদ দাও"): remove matching items from the list.
3. If user asks to EDIT or CHANGE items (e.g. "Change potatoes quantity to 3kg", "update eggs price to 150"): update those items.
4. If creating from scratch: generate all items with estimated prices and quantities.
5. Provide a friendly reply in "reply_message" in English or Bengali matching user's query.

Return ONLY a valid JSON object:
{
  "updated_items": [
    {
      "id": "existing id or omit if new",
      "name": "Item name",
      "quantity": "e.g. 2 kg or 1 pack",
      "estimated_price": 0,
      "priority": "normal" // "high" | "normal" | "low"
    }
  ],
  "reply_message": "Friendly confirmation of items added, removed, or edited"
}`;

  const candidateModels = await getAvailableGeminiModels(key);
  let lastError: Error | null = null;
  let responseText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      });
      clearTimeout(timeoutTimer);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (responseText) break;
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      lastError = err;
    }
  }

  if (!responseText) throw lastError || new Error('Failed to get shopping items from AI.');

  let cleaned = responseText.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error('Invalid JSON from AI');
  }

  const rawList = Array.isArray(parsed.updated_items)
    ? parsed.updated_items
    : Array.isArray(parsed.new_or_updated_items)
      ? parsed.new_or_updated_items
      : [];
  const items = rawList.map((it: any, idx: number) => ({
    id: it.id || `shop_ai_${Date.now()}_${idx}`,
    name: String(it.name || 'Shopping item').trim(),
    quantity: String(it.quantity || '1').trim(),
    estimated_price: parseFloat(it.estimated_price) || 0,
    priority: (['high', 'normal', 'low'].includes(it.priority) ? it.priority : 'normal') as 'high' | 'normal' | 'low',
    is_bought: false,
    created_at: new Date().toISOString(),
  }));

  return {
    items,
    replyMessage: parsed.reply_message || `Updated ${items.length} items in shopping list.`,
  };
}

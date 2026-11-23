// Currency Conversion & Number Formatting Utilities with Baseline Rates & Global Country Support
'use client';

import React, { useState, useEffect, useCallback } from 'react';

export interface CountryCurrency {
  country: string;
  flag: string;
  code: string;
  name: string;
  symbol: string;
  rateToUSD: number; // 1 unit of this currency = X USD
}

export interface CurrencyRate extends CountryCurrency {}

export const SUPPORTED_COUNTRIES: CountryCurrency[] = [
  // South Asia
  { country: 'Bangladesh', flag: '🇧🇩', code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', rateToUSD: 0.0083 },
  { country: 'India', flag: '🇮🇳', code: 'INR', name: 'Indian Rupee', symbol: '₹', rateToUSD: 0.0118 },
  { country: 'Pakistan', flag: '🇵🇰', code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', rateToUSD: 0.0036 },
  { country: 'Nepal', flag: '🇳🇵', code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू', rateToUSD: 0.0075 },
  { country: 'Sri Lanka', flag: '🇱🇰', code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', rateToUSD: 0.0034 },

  // Middle East & Gulf (GCC)
  { country: 'Saudi Arabia', flag: '🇸🇦', code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rateToUSD: 0.266 },
  { country: 'United Arab Emirates', flag: '🇦🇪', code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rateToUSD: 0.272 },
  { country: 'Qatar', flag: '🇶🇦', code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', rateToUSD: 0.274 },
  { country: 'Kuwait', flag: '🇰🇼', code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', rateToUSD: 3.25 },
  { country: 'Oman', flag: '🇴🇲', code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع', rateToUSD: 2.60 },
  { country: 'Bahrain', flag: '🇧🇭', code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', rateToUSD: 2.65 },
  { country: 'Egypt', flag: '🇪🇬', code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', rateToUSD: 0.020 },
  { country: 'Turkey', flag: '🇹🇷', code: 'TRY', name: 'Turkish Lira', symbol: '₺', rateToUSD: 0.029 },

  // Southeast & East Asia
  { country: 'Malaysia', flag: '🇲🇾', code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', rateToUSD: 0.224 },
  { country: 'Singapore', flag: '🇸🇬', code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rateToUSD: 0.755 },
  { country: 'Indonesia', flag: '🇮🇩', code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', rateToUSD: 0.000063 },
  { country: 'Philippines', flag: '🇵🇭', code: 'PHP', name: 'Philippine Peso', symbol: '₱', rateToUSD: 0.017 },
  { country: 'Thailand', flag: '🇹🇭', code: 'THB', name: 'Thai Baht', symbol: '฿', rateToUSD: 0.029 },
  { country: 'Vietnam', flag: '🇻🇳', code: 'VND', name: 'Vietnamese Dong', symbol: '₫', rateToUSD: 0.000039 },
  { country: 'Japan', flag: '🇯🇵', code: 'JPY', name: 'Japanese Yen', symbol: '¥', rateToUSD: 0.0065 },
  { country: 'China', flag: '🇨🇳', code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rateToUSD: 0.138 },
  { country: 'South Korea', flag: '🇰🇷', code: 'KRW', name: 'South Korean Won', symbol: '₩', rateToUSD: 0.00072 },

  // North America & Europe & Oceania
  { country: 'United States', flag: '🇺🇸', code: 'USD', name: 'US Dollar', symbol: '$', rateToUSD: 1.0 },
  { country: 'European Union', flag: '🇪🇺', code: 'EUR', name: 'Euro', symbol: '€', rateToUSD: 1.08 },
  { country: 'United Kingdom', flag: '🇬🇧', code: 'GBP', name: 'British Pound', symbol: '£', rateToUSD: 1.29 },
  { country: 'Canada', flag: '🇨🇦', code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', rateToUSD: 0.73 },
  { country: 'Australia', flag: '🇦🇺', code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rateToUSD: 0.66 },
  { country: 'New Zealand', flag: '🇳🇿', code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', rateToUSD: 0.59 },
  { country: 'Switzerland', flag: '🇨🇭', code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', rateToUSD: 1.13 },
  { country: 'Sweden', flag: '🇸🇪', code: 'SEK', name: 'Swedish Krona', symbol: 'kr', rateToUSD: 0.091 },
  { country: 'Norway', flag: '🇳🇴', code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', rateToUSD: 0.091 },
  { country: 'Denmark', flag: '🇩🇰', code: 'DKK', name: 'Danish Krone', symbol: 'kr', rateToUSD: 0.145 },
  { country: 'Poland', flag: '🇵🇱', code: 'PLN', name: 'Polish Zloty', symbol: 'zł', rateToUSD: 0.245 },
  { country: 'Russia', flag: '🇷🇺', code: 'RUB', name: 'Russian Ruble', symbol: '₽', rateToUSD: 0.010 },

  // Africa & Latin America
  { country: 'South Africa', flag: '🇿🇦', code: 'ZAR', name: 'South African Rand', symbol: 'R', rateToUSD: 0.055 },
  { country: 'Nigeria', flag: '🇳🇬', code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rateToUSD: 0.0006 },
  { country: 'Brazil', flag: '🇧🇷', code: 'BRL', name: 'Brazilian Real', symbol: 'R$', rateToUSD: 0.173 },
  { country: 'Mexico', flag: '🇲🇽', code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', rateToUSD: 0.049 },
];

export const CURRENCY_RATES: Record<string, CurrencyRate> = SUPPORTED_COUNTRIES.reduce(
  (acc, curr) => {
    acc[curr.code] = curr;
    return acc;
  },
  {} as Record<string, CurrencyRate>
);

export function getCurrencySymbol(codeOrSymbol?: string): string {
  if (!codeOrSymbol) return '$';
  const trimmed = codeOrSymbol.trim();
  const knownSymbols = [
    '$', '৳', '€', '£', '₹', '¥', '₩', '₺', '₽', '฿', '₫', '₱',
    '﷼', 'د.إ', 'ر.ق', 'د.ك', 'ر.ع', '.د.ب', '₨', 'RM', 'Rp',
    'रू', 'Rs', 'E£', '₦', 'R', 'R$', 'Mex$', 'CA$', 'A$', 'NZ$', 'CHF', 'kr', 'zł'
  ];
  if (knownSymbols.includes(trimmed)) {
    return trimmed;
  }
  const upper = trimmed.toUpperCase();
  if (CURRENCY_RATES[upper]?.symbol) {
    return CURRENCY_RATES[upper].symbol;
  }
  return '$';
}

export function getCountryByCurrency(codeOrSymbol?: string): CountryCurrency | undefined {
  if (!codeOrSymbol) return undefined;
  const upper = codeOrSymbol.trim().toUpperCase();
  return CURRENCY_RATES[upper] || SUPPORTED_COUNTRIES.find((c) => c.symbol === codeOrSymbol);
}

export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string
): number {
  if (fromCode === toCode) return amount;
  const from = CURRENCY_RATES[fromCode] || { rateToUSD: 1.0 };
  const to = CURRENCY_RATES[toCode] || { rateToUSD: 1.0 };

  // Convert from -> USD -> to
  const inUSD = amount * from.rateToUSD;
  const converted = inUSD / to.rateToUSD;
  return converted;
}

// Decimal Display Preferences ('2' = 5.00, '0' = 5)
export type DecimalMode = '2' | '0';

export const KEY_DECIMAL_MODE = 'app_decimal_mode';

export function getDecimalMode(): DecimalMode {
  if (typeof window === 'undefined') return '2';
  try {
    const val = localStorage.getItem(KEY_DECIMAL_MODE);
    return val === '0' ? '0' : '2';
  } catch {
    return '2';
  }
}

export function setDecimalMode(mode: DecimalMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_DECIMAL_MODE, mode);
    window.dispatchEvent(new Event('decimal_mode_changed'));
  } catch (e) {
    console.error('Failed to save decimal mode:', e);
  }
}

export const NATIVE_DIGIT_MAP: Record<string, string[]> = {
  bn: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
  hi: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  ar: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
  ur: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
  fa: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
  zh: ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'],
  ja: ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'],
  th: ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'],
  ta: ['௦', '௧', '௨', '௩', '௪', '௫', '௬', '௭', '௮', '௯'],
};

export function transliterateToNativeDigits(formattedStr: string, lang: string): string {
  const digits = NATIVE_DIGIT_MAP[lang];
  if (!digits) return formattedStr;
  return formattedStr.replace(/[0-9]/g, (d) => digits[parseInt(d, 10)]);
}

export function formatAmount(val: number, forceMode?: DecimalMode, forceLang?: string): string {
  const mode = forceMode || getDecimalMode();
  const digits = mode === '0' ? 0 : 2;
  const activeLang = forceLang || (typeof window !== 'undefined' ? localStorage.getItem('app_language') || 'en' : 'en');

  const localeMap: Record<string, string> = {
    en: 'en-US',
    bn: 'bn-BD-u-nu-beng',
    hi: 'hi-IN-u-nu-deva',
    ar: 'ar-EG-u-nu-arab',
    ur: 'ur-PK-u-nu-arabext',
    fa: 'fa-IR-u-nu-arabext',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    zh: 'zh-CN-u-nu-hanidec',
    ja: 'ja-JP-u-nu-hanidec',
    pt: 'pt-BR',
    ru: 'ru-RU',
    id: 'id-ID',
    tr: 'tr-TR',
    it: 'it-IT',
    ko: 'ko-KR',
    vi: 'vi-VN',
    th: 'th-TH-u-nu-thai',
    ms: 'ms-MY',
    nl: 'nl-NL',
    pl: 'pl-PL',
    sv: 'sv-SE',
    ta: 'ta-IN-u-nu-tamldec',
  };

  let formatted = '';
  try {
    const locale = localeMap[activeLang] || 'en-US';
    formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(val);
  } catch {
    formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(val);
  }

  return transliterateToNativeDigits(formatted, activeLang);
}

export function useDecimalFormat() {
  const [decimalMode, setDecimalModeState] = useState<DecimalMode>('2');
  const [lang, setLangState] = useState<string>('en');

  useEffect(() => {
    setDecimalModeState(getDecimalMode());
    setLangState(typeof window !== 'undefined' ? localStorage.getItem('app_language') || 'en' : 'en');
    const handleUpdate = () => {
      setDecimalModeState(getDecimalMode());
    };
    const handleLangUpdate = (e: Event) => {
      const newLang = (e as CustomEvent).detail || (typeof window !== 'undefined' ? localStorage.getItem('app_language') || 'en' : 'en');
      setLangState(newLang);
    };
    window.addEventListener('decimal_mode_changed', handleUpdate);
    window.addEventListener('applanguagechange', handleLangUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('decimal_mode_changed', handleUpdate);
      window.removeEventListener('applanguagechange', handleLangUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const changeDecimalMode = useCallback((mode: DecimalMode) => {
    setDecimalMode(mode);
    setDecimalModeState(mode);
  }, []);

  const format = useCallback(
    (val: number) => {
      return formatAmount(val, decimalMode, lang);
    },
    [decimalMode, lang]
  );

  return {
    decimalMode,
    setDecimalMode: changeDecimalMode,
    formatAmount: format,
  };
}

export function CurrencySymbol({
  symbol,
  className = '',
}: {
  symbol?: string;
  className?: string;
}) {
  const sym = getCurrencySymbol(symbol);
  return React.createElement('span', { className: `currency-symbol ${className}` }, sym);
}

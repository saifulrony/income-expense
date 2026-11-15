// Currency Conversion & Number Formatting Utilities with Baseline Rates
'use client';

import React, { useState, useEffect, useCallback } from 'react';

export interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rateToUSD: number; // 1 unit of this currency = X USD
}

export const CURRENCY_RATES: Record<string, CurrencyRate> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rateToUSD: 1.0 },
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', rateToUSD: 0.0083 }, // 1 USD ≈ 120 BDT
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rateToUSD: 1.08 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rateToUSD: 1.29 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', rateToUSD: 0.012 }, // 1 USD ≈ 84 INR
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: '$', rateToUSD: 0.73 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: '$', rateToUSD: 0.66 },
};

export function getCurrencySymbol(codeOrSymbol?: string): string {
  if (!codeOrSymbol) return '$';
  const trimmed = codeOrSymbol.trim();
  if (['$', '৳', '€', '£', '₹', '¥', '₩', '₺', '₽', '฿', '₫', '₱'].includes(trimmed)) {
    return trimmed;
  }
  const upper = trimmed.toUpperCase();
  const symbolMap: Record<string, string> = {
    USD: '$',
    BDT: '৳',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    CAD: '$',
    AUD: '$',
    JPY: '¥',
    CNY: '¥',
    KRW: '₩',
    TRY: '₺',
    RUB: '₽',
    THB: '฿',
    VND: '₫',
    PHP: '₱',
    SGD: '$',
    HKD: '$',
    NZD: '$',
  };
  return symbolMap[upper] || CURRENCY_RATES[upper]?.symbol || '$';
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

export function formatAmount(val: number, forceMode?: DecimalMode): string {
  const mode = forceMode || getDecimalMode();
  const digits = mode === '0' ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(val);
}

export function useDecimalFormat() {
  const [decimalMode, setDecimalModeState] = useState<DecimalMode>('2');

  useEffect(() => {
    setDecimalModeState(getDecimalMode());
    const handleUpdate = () => {
      setDecimalModeState(getDecimalMode());
    };
    window.addEventListener('decimal_mode_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('decimal_mode_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const changeDecimalMode = useCallback((mode: DecimalMode) => {
    setDecimalMode(mode);
    setDecimalModeState(mode);
  }, []);

  const format = useCallback(
    (val: number) => {
      return formatAmount(val, decimalMode);
    },
    [decimalMode]
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


// Currency Conversion Utilities with Baseline Rates

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
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rateToUSD: 0.73 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rateToUSD: 0.66 },
};

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


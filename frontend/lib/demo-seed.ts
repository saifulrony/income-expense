import { OfflineStorage } from './offline-storage';

/**
 * Seeds the local demo/offline account with ~3 months of realistic sample
 * records, so the first screen shows the app populated instead of $0.00.
 * No-op when any transactions already exist.
 */
export function seedDemoDataIfEmpty(): boolean {
  try {
    const existing = OfflineStorage.getTransactions({});
    if (existing.length > 0) return false;

    const categories = OfflineStorage.getCategories();
    if (!categories.length) return false;

    const pickCat = (type: 'income' | 'expense', ...keywords: string[]) => {
      const typed = categories.filter((c) => c.type === type);
      for (const kw of keywords) {
        const hit = typed.find((c) => c.name.toLowerCase().includes(kw));
        if (hit) return hit;
      }
      return typed[0] || categories[0];
    };

    const daysAgo = (n: number, hour = 12, minute = 30) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };

    type Sample = {
      type: 'income' | 'expense';
      amount: number;
      note: string;
      cat: [('income' | 'expense'), ...string[]];
      day: number;
      method?: string;
      hour?: number;
    };

    const samples: Sample[] = [
      // ~3 months of salary + freelance income
      { type: 'income', amount: 45000, note: 'Monthly Salary', cat: ['income', 'salary'], day: 72, method: 'bank', hour: 10 },
      { type: 'income', amount: 45000, note: 'Monthly Salary', cat: ['income', 'salary'], day: 42, method: 'bank', hour: 10 },
      { type: 'income', amount: 46500, note: 'Monthly Salary', cat: ['income', 'salary'], day: 12, method: 'bank', hour: 10 },
      { type: 'income', amount: 8200, note: 'Freelance project', cat: ['income', 'free', 'business'], day: 34, method: 'mobile', hour: 20 },
      { type: 'income', amount: 5600, note: 'Side gig payout', cat: ['income', 'free', 'other'], day: 6, method: 'mobile', hour: 18 },

      // Recurring bills & housing
      { type: 'expense', amount: 15000, note: 'Apartment rent', cat: ['expense', 'rent', 'hous'], day: 70, method: 'bank', hour: 9 },
      { type: 'expense', amount: 15000, note: 'Apartment rent', cat: ['expense', 'rent', 'hous'], day: 40, method: 'bank', hour: 9 },
      { type: 'expense', amount: 15000, note: 'Apartment rent', cat: ['expense', 'rent', 'hous'], day: 10, method: 'bank', hour: 9 },
      { type: 'expense', amount: 1850, note: 'Electricity bill', cat: ['expense', 'util', 'bill'], day: 38, method: 'mobile', hour: 19 },
      { type: 'expense', amount: 1920, note: 'Electricity bill', cat: ['expense', 'util', 'bill'], day: 8, method: 'mobile', hour: 19 },
      { type: 'expense', amount: 1100, note: 'Internet (fiber)', cat: ['expense', 'util', 'bill'], day: 7, method: 'mobile', hour: 11 },

      // Groceries & food
      { type: 'expense', amount: 3250, note: 'Weekly groceries', cat: ['expense', 'groc', 'food'], day: 25, method: 'cash', hour: 17 },
      { type: 'expense', amount: 2780, note: 'Weekly groceries', cat: ['expense', 'groc', 'food'], day: 16, method: 'cash', hour: 17 },
      { type: 'expense', amount: 3540, note: 'Groceries & household', cat: ['expense', 'groc', 'food'], day: 4, method: 'card', hour: 18 },
      { type: 'expense', amount: 640, note: 'Lunch with team', cat: ['expense', 'food', 'dining'], day: 3, method: 'cash', hour: 13 },
      { type: 'expense', amount: 420, note: 'Coffee & snacks', cat: ['expense', 'food', 'dining'], day: 1, method: 'cash', hour: 16 },

      // Transport, health, fun
      { type: 'expense', amount: 950, note: 'Ride-share & fuel', cat: ['expense', 'trans'], day: 15, method: 'mobile', hour: 8 },
      { type: 'expense', amount: 760, note: 'Pharmacy', cat: ['expense', 'health'], day: 20, method: 'cash', hour: 19 },
      { type: 'expense', amount: 1500, note: 'Movie night & dinner', cat: ['expense', 'enter', 'fun'], day: 9, method: 'card', hour: 21 },
      { type: 'expense', amount: 2890, note: 'New headphones', cat: ['expense', 'shop'], day: 2, method: 'card', hour: 15 },
    ];

    samples.forEach((s) => {
      const [type, ...keywords] = s.cat;
      const cat = pickCat(type, ...keywords);
      OfflineStorage.createTransaction({
        amount: s.amount,
        type: s.type,
        category_id: cat.id,
        payment_method: s.method || 'cash',
        note: s.note,
        date: daysAgo(s.day, s.hour ?? 12),
      });
    });

    return true;
  } catch (e) {
    console.warn('Demo seed skipped:', e);
    return false;
  }
}

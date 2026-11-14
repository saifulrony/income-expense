'use client';

import {
  User,
  SubAccount,
  Category,
  Transaction,
  BudgetOverview,
  BudgetStatusItem,
  RecurringTransaction,
  SummaryData,
  CategoryBreakdown,
  MonthlyTrend,
  AnalyticsInsights,
  PaymentMethodStat,
  DayOfWeekStat,
  TopExpenseItem,
  BackupPayload,
} from './types';

// Storage keys
const KEY_OFFLINE_USER = 'cashflow_offline_user';
const KEY_OFFLINE_ACCOUNTS = 'cashflow_offline_accounts';
const KEY_OFFLINE_CATEGORIES = 'cashflow_offline_categories';
const KEY_OFFLINE_TRANSACTIONS = 'cashflow_offline_transactions';
const KEY_OFFLINE_BUDGETS = 'cashflow_offline_budgets';
const KEY_OFFLINE_RECURRING = 'cashflow_offline_recurring';
const KEY_APP_MODE = 'app_mode'; // 'online' | 'offline'

export type AppMode = 'online' | 'offline';

export function getAppMode(): AppMode {
  if (typeof window === 'undefined') return 'online';
  return (localStorage.getItem(KEY_APP_MODE) as AppMode) || 'online';
}

export function setAppMode(mode: AppMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY_APP_MODE, mode);
  }
}

// Helpers for localStorage
function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

// Default Seed Categories
const DEFAULT_EXPENSE_CATEGORIES: Array<Omit<Category, 'id' | 'user_id' | 'created_at'>> = [
  { name: 'Rent & Housing', type: 'expense', icon: 'Home', color: '#3B82F6', is_default: true },
  { name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#F59E0B', is_default: true },
  { name: 'Transportation', type: 'expense', icon: 'Car', color: '#10B981', is_default: true },
  { name: 'Utilities', type: 'expense', icon: 'Zap', color: '#06B6D4', is_default: true },
  { name: 'Shopping & Groceries', type: 'expense', icon: 'ShoppingBag', color: '#EC4899', is_default: true },
  { name: 'Healthcare', type: 'expense', icon: 'HeartPulse', color: '#EF4444', is_default: true },
  { name: 'Entertainment', type: 'expense', icon: 'Film', color: '#8B5CF6', is_default: true },
  { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#6366F1', is_default: true },
  { name: 'Personal Care', type: 'expense', icon: 'Smile', color: '#14B8A6', is_default: true },
  { name: 'Other Expense', type: 'expense', icon: 'MoreHorizontal', color: '#64748B', is_default: true },
];

const DEFAULT_INCOME_CATEGORIES: Array<Omit<Category, 'id' | 'user_id' | 'created_at'>> = [
  { name: 'Salary', type: 'income', icon: 'Briefcase', color: '#10B981', is_default: true },
  { name: 'Freelance & Consulting', type: 'income', icon: 'Laptop', color: '#06B6D4', is_default: true },
  { name: 'Investments & Dividends', type: 'income', icon: 'TrendingUp', color: '#8B5CF6', is_default: true },
  { name: 'Business Income', type: 'income', icon: 'Building2', color: '#3B82F6', is_default: true },
  { name: 'Rental Income', type: 'income', icon: 'Home', color: '#F59E0B', is_default: true },
  { name: 'Gifts & Grants', type: 'income', icon: 'Gift', color: '#EC4899', is_default: true },
  { name: 'Other Income', type: 'income', icon: 'Coins', color: '#64748B', is_default: true },
];

const DEFAULT_USER: User = {
  id: 'device-offline-user',
  email: 'offline@device.local',
  full_name: 'Offline Account',
  currency: 'USD',
};

const DEFAULT_ACCOUNTS: SubAccount[] = [
  {
    id: 'offline-acc-personal',
    user_id: 'device-offline-user',
    name: 'Personal',
    type: 'personal',
    icon: 'Wallet',
    color: '#10B981',
    is_default: true,
    total_income: 0,
    total_expense: 0,
    balance: 0,
    transaction_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'offline-acc-family',
    user_id: 'device-offline-user',
    name: 'Family',
    type: 'family',
    icon: 'Users',
    color: '#3B82F6',
    is_default: false,
    total_income: 0,
    total_expense: 0,
    balance: 0,
    transaction_count: 0,
    created_at: new Date().toISOString(),
  },
];

export class OfflineStorage {
  // 1. User Profile
  static getUser(): User {
    const user = getItem<User | null>(KEY_OFFLINE_USER, null);
    if (!user) {
      setItem(KEY_OFFLINE_USER, DEFAULT_USER);
      return DEFAULT_USER;
    }
    return user;
  }

  static updateUser(updates: Partial<User>): User {
    const current = this.getUser();
    const updated = { ...current, ...updates };
    setItem(KEY_OFFLINE_USER, updated);
    return updated;
  }

  // 2. Sub-Accounts
  static getAccounts(): SubAccount[] {
    let accounts = getItem<SubAccount[]>(KEY_OFFLINE_ACCOUNTS, []);
    if (!accounts || accounts.length === 0) {
      accounts = DEFAULT_ACCOUNTS;
      setItem(KEY_OFFLINE_ACCOUNTS, accounts);
    }

    // Recompute balances from transactions
    const txs = this.getTransactions();
    return accounts.map((acc) => {
      const accTxs = txs.filter((t) => t.account_id === acc.id);
      const inc = accTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const exp = accTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return {
        ...acc,
        total_income: inc,
        total_expense: exp,
        balance: inc - exp,
        transaction_count: accTxs.length,
      };
    });
  }

  static createAccount(data: { name: string; type?: string; icon?: string; color?: string; is_default?: boolean }): SubAccount {
    const accounts = this.getAccounts();
    const id = 'offline-acc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newAcc: SubAccount = {
      id,
      user_id: this.getUser().id,
      name: data.name,
      type: data.type || 'personal',
      icon: data.icon || 'Wallet',
      color: data.color || '#3B82F6',
      is_default: data.is_default || accounts.length === 0,
      total_income: 0,
      total_expense: 0,
      balance: 0,
      transaction_count: 0,
      created_at: new Date().toISOString(),
    };

    if (newAcc.is_default) {
      accounts.forEach((a) => (a.is_default = false));
    }

    accounts.push(newAcc);
    setItem(KEY_OFFLINE_ACCOUNTS, accounts);
    return newAcc;
  }

  static updateAccount(id: string, data: Partial<SubAccount>): SubAccount {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Account not found');

    if (data.is_default) {
      accounts.forEach((a) => (a.is_default = false));
    }

    accounts[idx] = { ...accounts[idx], ...data };
    setItem(KEY_OFFLINE_ACCOUNTS, accounts);
    return accounts[idx];
  }

  static deleteAccount(id: string): void {
    let accounts = this.getAccounts();
    if (accounts.length <= 1) {
      throw new Error('Cannot delete your only account.');
    }
    accounts = accounts.filter((a) => a.id !== id);
    if (!accounts.some((a) => a.is_default)) {
      accounts[0].is_default = true;
    }
    setItem(KEY_OFFLINE_ACCOUNTS, accounts);
  }

  // 3. Categories
  static getCategories(): Category[] {
    let categories = getItem<Category[]>(KEY_OFFLINE_CATEGORIES, []);
    if (!categories || categories.length === 0) {
      const now = new Date().toISOString();
      const allDefaults = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
          ...c,
          id: `offline-cat-exp-${i + 1}`,
          user_id: 'device-offline-user',
          created_at: now,
        })),
        ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
          ...c,
          id: `offline-cat-inc-${i + 1}`,
          user_id: 'device-offline-user',
          created_at: now,
        })),
      ];
      setItem(KEY_OFFLINE_CATEGORIES, allDefaults);
      return allDefaults;
    }
    return categories;
  }

  static createCategory(data: { name: string; type: 'income' | 'expense'; icon?: string; color?: string }): Category {
    const categories = this.getCategories();
    const id = 'offline-cat-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newCat: Category = {
      id,
      user_id: this.getUser().id,
      name: data.name,
      type: data.type,
      icon: data.icon || 'Tag',
      color: data.color || '#10B981',
      is_default: false,
      created_at: new Date().toISOString(),
    };
    categories.push(newCat);
    setItem(KEY_OFFLINE_CATEGORIES, categories);
    return newCat;
  }

  static deleteCategory(id: string): void {
    let categories = this.getCategories();
    categories = categories.filter((c) => c.id !== id);
    setItem(KEY_OFFLINE_CATEGORIES, categories);
  }

  // 4. Transactions
  static getTransactions(filter?: { type?: string; category_id?: string; account_id?: string; start_date?: string; end_date?: string }): Transaction[] {
    let txs = getItem<Transaction[]>(KEY_OFFLINE_TRANSACTIONS, []);
    const categories = this.getCategories();
    const accounts = this.getAccounts();

    // Map category and account references
    let result = txs.map((t) => ({
      ...t,
      category: categories.find((c) => c.id === t.category_id) || {
        id: t.category_id,
        user_id: t.user_id,
        name: 'General',
        type: t.type,
        icon: 'Tag',
        color: '#64748B',
        is_default: false,
        created_at: t.created_at,
      },
      account: accounts.find((a) => a.id === t.account_id) || accounts[0],
    }));

    // Filter
    if (filter) {
      if (filter.type) result = result.filter((t) => t.type === filter.type);
      if (filter.category_id) result = result.filter((t) => t.category_id === filter.category_id);
      if (filter.account_id && filter.account_id !== 'all') {
        result = result.filter((t) => t.account_id === filter.account_id);
      }
      if (filter.start_date) {
        result = result.filter((t) => t.date >= filter.start_date!);
      }
      if (filter.end_date) {
        result = result.filter((t) => t.date <= filter.end_date!);
      }
    }

    // Sort by date descending
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }

  static createTransaction(data: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    account_id?: string;
    payment_method: string;
    note: string;
    receipt_image?: string;
    date: string;
  }): Transaction {
    const txs = getItem<Transaction[]>(KEY_OFFLINE_TRANSACTIONS, []);
    const categories = this.getCategories();
    const accounts = this.getAccounts();

    const cat = categories.find((c) => c.id === data.category_id) || categories[0];
    const acc = accounts.find((a) => a.id === data.account_id) || accounts.find((a) => a.is_default) || accounts[0];

    const now = new Date().toISOString();
    const id = 'offline-tx-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const newTx: Transaction = {
      id,
      user_id: this.getUser().id,
      account_id: acc.id,
      account: acc,
      amount: data.amount,
      type: data.type,
      category_id: data.category_id,
      category: cat,
      payment_method: data.payment_method || 'cash',
      note: data.note || '',
      receipt_image: data.receipt_image,
      date: data.date || now.split('T')[0],
      created_at: now,
      updated_at: now,
    };

    txs.unshift(newTx);
    setItem(KEY_OFFLINE_TRANSACTIONS, txs);
    return newTx;
  }

  static updateTransaction(
    id: string,
    data: {
      amount?: number;
      type?: 'income' | 'expense';
      category_id?: string;
      account_id?: string;
      payment_method?: string;
      note?: string;
      receipt_image?: string;
      date?: string;
    }
  ): Transaction {
    const txs = getItem<Transaction[]>(KEY_OFFLINE_TRANSACTIONS, []);
    const idx = txs.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');

    const categories = this.getCategories();
    const accounts = this.getAccounts();

    const existing = txs[idx];
    const catId = data.category_id || existing.category_id;
    const accId = data.account_id || existing.account_id;

    const cat = categories.find((c) => c.id === catId) || existing.category;
    const acc = accounts.find((a) => a.id === accId) || existing.account;

    const updated: Transaction = {
      ...existing,
      ...data,
      category_id: catId,
      category: cat,
      account_id: accId,
      account: acc,
      updated_at: new Date().toISOString(),
    };

    txs[idx] = updated;
    setItem(KEY_OFFLINE_TRANSACTIONS, txs);
    return updated;
  }

  static deleteTransaction(id: string): void {
    let txs = getItem<Transaction[]>(KEY_OFFLINE_TRANSACTIONS, []);
    txs = txs.filter((t) => t.id !== id);
    setItem(KEY_OFFLINE_TRANSACTIONS, txs);
  }

  // 5. Budgets
  static getBudgets(month?: string): BudgetOverview {
    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const storedBudgets = getItem<Array<{ id: string; category_id: string; amount: number; month: string }>>(KEY_OFFLINE_BUDGETS, []);
    const categories = this.getCategories().filter((c) => c.type === 'expense');
    const txs = this.getTransactions();

    const monthTxs = txs.filter((t) => t.type === 'expense' && t.date.startsWith(targetMonth));

    let totalBudget = 0;
    let totalSpent = 0;

    const items: BudgetStatusItem[] = storedBudgets
      .filter((b) => b.month === targetMonth)
      .map((b) => {
        const cat = categories.find((c) => c.id === b.category_id);
        const spent = monthTxs.filter((t) => t.category_id === b.category_id).reduce((sum, t) => sum + t.amount, 0);
        const rem = Math.max(0, b.amount - spent);
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        let status: 'safe' | 'warning' | 'exceeded' = 'safe';
        if (pct >= 100) status = 'exceeded';
        else if (pct >= 80) status = 'warning';

        totalBudget += b.amount;
        totalSpent += spent;

        return {
          budget_id: b.id,
          category_id: b.category_id,
          category_name: cat?.name || 'General',
          category_icon: cat?.icon || 'Tag',
          category_color: cat?.color || '#3B82F6',
          budget_limit: b.amount,
          actual_spent: spent,
          remaining: rem,
          percentage: pct,
          status,
          month: targetMonth,
        };
      });

    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      month: targetMonth,
      total_budget: totalBudget,
      total_spent: totalSpent,
      remaining: totalRemaining,
      percentage: overallPct,
      budgets: items,
    };
  }

  static setBudget(data: { category_id: string; amount: number; month: string }): void {
    let budgets = getItem<Array<{ id: string; category_id: string; amount: number; month: string }>>(KEY_OFFLINE_BUDGETS, []);
    const idx = budgets.findIndex((b) => b.category_id === data.category_id && b.month === data.month);

    if (idx !== -1) {
      budgets[idx].amount = data.amount;
    } else {
      budgets.push({
        id: 'offline-bgt-' + Date.now().toString(36),
        category_id: data.category_id,
        amount: data.amount,
        month: data.month,
      });
    }
    setItem(KEY_OFFLINE_BUDGETS, budgets);
  }

  static deleteBudget(id: string): void {
    let budgets = getItem<Array<{ id: string; category_id: string; amount: number; month: string }>>(KEY_OFFLINE_BUDGETS, []);
    budgets = budgets.filter((b) => b.id !== id);
    setItem(KEY_OFFLINE_BUDGETS, budgets);
  }

  // 6. Recurring Transactions
  static getRecurring(): RecurringTransaction[] {
    const list = getItem<RecurringTransaction[]>(KEY_OFFLINE_RECURRING, []);
    const categories = this.getCategories();
    return list.map((r) => ({
      ...r,
      category: categories.find((c) => c.id === r.category_id) || r.category,
    }));
  }

  static createRecurring(data: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method: string;
    note: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    next_run: string;
  }): RecurringTransaction {
    const list = getItem<RecurringTransaction[]>(KEY_OFFLINE_RECURRING, []);
    const categories = this.getCategories();
    const cat = categories.find((c) => c.id === data.category_id) || categories[0];

    const newRec: RecurringTransaction = {
      id: 'offline-rec-' + Date.now().toString(36),
      user_id: this.getUser().id,
      amount: data.amount,
      type: data.type,
      category_id: data.category_id,
      category: cat,
      payment_method: data.payment_method || 'cash',
      note: data.note || '',
      frequency: data.frequency,
      next_run: data.next_run,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    list.push(newRec);
    setItem(KEY_OFFLINE_RECURRING, list);
    return newRec;
  }

  static toggleRecurring(id: string): RecurringTransaction {
    const list = getItem<RecurringTransaction[]>(KEY_OFFLINE_RECURRING, []);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Recurring rule not found');
    list[idx].is_active = !list[idx].is_active;
    setItem(KEY_OFFLINE_RECURRING, list);
    return list[idx];
  }

  static deleteRecurring(id: string): void {
    let list = getItem<RecurringTransaction[]>(KEY_OFFLINE_RECURRING, []);
    list = list.filter((r) => r.id !== id);
    setItem(KEY_OFFLINE_RECURRING, list);
  }

  static processDueRecurring(): number {
    const list = getItem<RecurringTransaction[]>(KEY_OFFLINE_RECURRING, []);
    const today = new Date().toISOString().split('T')[0];
    let count = 0;

    list.forEach((rec) => {
      if (rec.is_active && rec.next_run <= today) {
        this.createTransaction({
          amount: rec.amount,
          type: rec.type,
          category_id: rec.category_id,
          payment_method: rec.payment_method,
          note: rec.note + ' (Auto-Recurring)',
          date: today,
        });

        // Compute next run
        const next = new Date(rec.next_run);
        if (rec.frequency === 'daily') next.setDate(next.getDate() + 1);
        else if (rec.frequency === 'weekly') next.setDate(next.getDate() + 7);
        else if (rec.frequency === 'monthly') next.setMonth(next.getMonth() + 1);

        rec.next_run = next.toISOString().split('T')[0];
        count++;
      }
    });

    if (count > 0) {
      setItem(KEY_OFFLINE_RECURRING, list);
    }
    return count;
  }

  // 7. Analytics & Summaries
  static getSummary(period = 'this_month', accountId?: string): SummaryData {
    const txs = this.getTransactions({ account_id: accountId });
    const filtered = this.filterByPeriod(txs, period);

    const incTxs = filtered.filter((t) => t.type === 'income');
    const expTxs = filtered.filter((t) => t.type === 'expense');

    const totalInc = incTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalExp = expTxs.reduce((sum, t) => sum + t.amount, 0);

    return {
      total_income: totalInc,
      total_expense: totalExp,
      net_balance: totalInc - totalExp,
      income_count: incTxs.length,
      expense_count: expTxs.length,
      total_count: filtered.length,
      period,
    };
  }

  static getCategoryBreakdown(type = 'expense', period = 'this_month', accountId?: string): CategoryBreakdown[] {
    const txs = this.getTransactions({ type, account_id: accountId });
    const filtered = this.filterByPeriod(txs, period);

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    const catMap = new Map<string, { category: Category; amount: number; count: number }>();

    filtered.forEach((t) => {
      const existing = catMap.get(t.category_id);
      if (existing) {
        existing.amount += t.amount;
        existing.count += 1;
      } else {
        catMap.set(t.category_id, {
          category: t.category,
          amount: t.amount,
          count: 1,
        });
      }
    });

    const breakdown: CategoryBreakdown[] = Array.from(catMap.values()).map(({ category, amount, count }) => ({
      category_id: category.id,
      category_name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
      total_amount: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      count,
    }));

    breakdown.sort((a, b) => b.total_amount - a.total_amount);
    return breakdown;
  }

  static getMonthlyTrends(accountId?: string): MonthlyTrend[] {
    const txs = this.getTransactions({ account_id: accountId });
    const monthMap = new Map<string, { income: number; expense: number }>();

    // Generate last 6 months keys
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      monthMap.set(key, { income: 0, expense: 0 });
    }

    txs.forEach((t) => {
      const month = t.date.slice(0, 7);
      if (monthMap.has(month)) {
        const item = monthMap.get(month)!;
        if (t.type === 'income') item.income += t.amount;
        else item.expense += t.amount;
      }
    });

    return Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    }));
  }

  static getAnalyticsInsights(period = 'this_month', accountId?: string): AnalyticsInsights {
    const txs = this.getTransactions({ account_id: accountId });
    const filtered = this.filterByPeriod(txs, period);

    const incTxs = filtered.filter((t) => t.type === 'income');
    const expTxs = filtered.filter((t) => t.type === 'expense');

    const totalInc = incTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalExp = expTxs.reduce((sum, t) => sum + t.amount, 0);

    const savingsRate = totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 1000) / 10 : 0;
    let savingsHealth: 'High' | 'Healthy' | 'Modest' | 'Deficit' | 'Neutral' = 'Neutral';
    if (savingsRate >= 30) savingsHealth = 'High';
    else if (savingsRate >= 15) savingsHealth = 'Healthy';
    else if (savingsRate > 0) savingsHealth = 'Modest';
    else if (savingsRate < 0) savingsHealth = 'Deficit';

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());

    const dailyAvgExp = Math.round((totalExp / daysElapsed) * 100) / 100;
    const dailyAvgInc = Math.round((totalInc / daysElapsed) * 100) / 100;
    const projectedExp = Math.round(dailyAvgExp * daysInMonth * 100) / 100;

    // Payment methods
    const payMap = new Map<string, { amount: number; count: number }>();
    expTxs.forEach((t) => {
      const m = t.payment_method || 'other';
      const item = payMap.get(m) || { amount: 0, count: 0 };
      item.amount += t.amount;
      item.count += 1;
      payMap.set(m, item);
    });

    const paymentMethods: PaymentMethodStat[] = Array.from(payMap.entries()).map(([method, data]) => ({
      method,
      amount: data.amount,
      count: data.count,
      percentage: totalExp > 0 ? Math.round((data.amount / totalExp) * 1000) / 10 : 0,
    }));
    paymentMethods.sort((a, b) => b.amount - a.amount);

    // Day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats: DayOfWeekStat[] = dayNames.map((d, i) => ({
      day: d,
      day_num: i,
      expense: 0,
      income: 0,
      count: 0,
    }));

    filtered.forEach((t) => {
      const dayIdx = new Date(t.date).getDay();
      if (dayIdx >= 0 && dayIdx < 7) {
        dayStats[dayIdx].count += 1;
        if (t.type === 'expense') dayStats[dayIdx].expense += t.amount;
        else dayStats[dayIdx].income += t.amount;
      }
    });

    let peakDay = 'None';
    let maxExp = 0;
    dayStats.forEach((ds) => {
      if (ds.expense > maxExp) {
        maxExp = ds.expense;
        peakDay = ds.day;
      }
    });

    // Top Expenses
    const topExpenses: TopExpenseItem[] = expTxs
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        note: t.note,
        date: t.date,
        category_name: t.category.name,
        color: t.category.color,
        icon: t.category.icon,
      }));

    return {
      savings_rate: savingsRate,
      savings_health: savingsHealth,
      daily_average_expense: dailyAvgExp,
      daily_average_income: dailyAvgInc,
      projected_month_expense: projectedExp,
      days_elapsed: daysElapsed,
      days_in_period: daysInMonth,
      expense_diff_pct: 0,
      income_diff_pct: 0,
      payment_methods: paymentMethods,
      day_of_week_stats: dayStats,
      peak_spending_day: peakDay,
      top_expenses: topExpenses,
    };
  }

  // 8. Backups
  static exportBackup(): BackupPayload {
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      user_email: this.getUser().email,
      currency: this.getUser().currency,
      categories: this.getCategories(),
      transactions: this.getTransactions(),
    };
  }

  static importBackup(payload: BackupPayload): { categories_imported: number; transactions_imported: number } {
    if (payload.categories && Array.isArray(payload.categories)) {
      setItem(KEY_OFFLINE_CATEGORIES, payload.categories);
    }
    if (payload.transactions && Array.isArray(payload.transactions)) {
      setItem(KEY_OFFLINE_TRANSACTIONS, payload.transactions);
    }
    if (payload.currency) {
      this.updateUser({ currency: payload.currency });
    }
    return {
      categories_imported: payload.categories?.length || 0,
      transactions_imported: payload.transactions?.length || 0,
    };
  }

  // Clear / Reset
  static clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(KEY_OFFLINE_USER);
    localStorage.removeItem(KEY_OFFLINE_ACCOUNTS);
    localStorage.removeItem(KEY_OFFLINE_CATEGORIES);
    localStorage.removeItem(KEY_OFFLINE_TRANSACTIONS);
    localStorage.removeItem(KEY_OFFLINE_BUDGETS);
    localStorage.removeItem(KEY_OFFLINE_RECURRING);
  }

  // Helper
  private static filterByPeriod(txs: Transaction[], period: string): Transaction[] {
    const now = new Date();
    const thisMonthPrefix = now.toISOString().slice(0, 7);

    if (period === 'this_month') {
      return txs.filter((t) => t.date.startsWith(thisMonthPrefix));
    } else if (period === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);
      return txs.filter((t) => t.date.startsWith(lastMonthPrefix));
    } else if (period === 'this_year') {
      const yearPrefix = now.getFullYear().toString();
      return txs.filter((t) => t.date.startsWith(yearPrefix));
    }
    return txs; // all_time
  }
}

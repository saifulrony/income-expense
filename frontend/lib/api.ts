import { Preferences } from '@capacitor/preferences';
import { 
  User, 
  SubAccount,
  Category, 
  Transaction, 
  SummaryData, 
  CategoryBreakdown, 
  MonthlyTrend, 
  BackupPayload, 
  BackupLog,
  BudgetOverview,
  RecurringTransaction
} from './types';

// Default API URL (can be customized via localStorage for mobile testing against physical device IP)
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export async function getApiUrl(): Promise<string> {
  if (typeof window !== 'undefined') {
    // 1. Explicit user override from Settings (if configured and not standard localhost)
    const stored = localStorage.getItem('custom_api_url');
    if (stored && !stored.includes('localhost') && !stored.includes('127.0.0.1')) {
      return stored;
    }

    // 2. In browser (standard web) -> always use relative '/api'
    // Proxied seamlessly by Next.js rewrites to Go backend on 127.0.0.1:8080
    // Completely eliminates CORS, port 8080 blocks, and Mixed Content errors!
    return '/api';
  }

  return DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('custom_api_url', url);
  }
  try {
    await Preferences.set({ key: 'custom_api_url', value: url });
  } catch (e) {}
}

export async function getAuthToken(): Promise<string | null> {
  // Synchronous web read: 0ms, never hangs
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  try {
    const { value } = await Preferences.get({ key: 'auth_token' });
    return value || null;
  } catch (e) {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
  try {
    await Preferences.set({ key: 'auth_token', value: token });
  } catch (e) {}
}

export async function removeAuthToken(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
  try {
    await Preferences.remove({ key: 'auth_token' });
  } catch (e) {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiUrl();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${endpoint}`;

  // Add 10-second timeout controller so requests never hang indefinitely
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // If token is invalid or expired, drop it so user is returned to login
    if (response.status === 401) {
      await removeAuthToken();
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your network connection.');
    }
    throw err;
  }
}

// API Methods
export const api = {
  // Auth
  register: (payload: { email: string; password: string; full_name?: string; currency?: string }) =>
    request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProfile: () =>
    request<{ user: User }>('/auth/profile'),

  updateProfile: (payload: { full_name?: string; currency?: string }) =>
    request<{ message: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    request<{ message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAccount: () =>
    request<{ message: string }>('/auth/account', {
      method: 'DELETE',
    }),

  // Sub-Accounts (Multi-Ledger: Personal, Family, Business, etc.)
  getAccounts: () =>
    request<{ accounts: SubAccount[] }>('/accounts'),

  createAccount: (payload: { name: string; type?: string; icon?: string; color?: string; is_default?: boolean }) =>
    request<{ message: string; account: SubAccount }>('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAccount: (id: string, payload: { name?: string; type?: string; icon?: string; color?: string; is_default?: boolean }) =>
    request<{ message: string }>('/accounts/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAccountItem: (id: string) =>
    request<{ message: string }>('/accounts/' + id, {
      method: 'DELETE',
    }),

  // Categories
  getCategories: (type?: string) =>
    request<{ categories: Category[] }>(`/categories${type ? `?type=${type}` : ''}`),

  createCategory: (payload: { name: string; type: 'income' | 'expense'; icon?: string; color?: string }) =>
    request<{ category: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCategory: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Transactions
  getTransactions: (params?: { 
    account_id?: string;
    type?: string; 
    category_id?: string; 
    payment_method?: string; 
    start_date?: string; 
    end_date?: string; 
    search?: string; 
    page?: number; 
    limit?: number; 
  }) => {
    const query = new URLSearchParams();
    if (params?.account_id) query.set('account_id', params.account_id);
    if (params?.type) query.set('type', params.type);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.payment_method) query.set('payment_method', params.payment_method);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return request<{ transactions: Transaction[]; pagination: unknown }>(`/transactions${qs ? `?${qs}` : ''}`);
  },

  createTransaction: (payload: {
    account_id?: string;
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
    receipt_image?: string;
    date?: string;
  }) =>
    request<{ message: string; transaction: Transaction }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTransaction: (id: string, payload: {
    account_id?: string;
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
    receipt_image?: string;
    date?: string;
  }) =>
    request<{ message: string; transaction: Transaction }>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteTransaction: (id: string) =>
    request<{ message: string }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),

  // Budgets & Spending Limits
  getBudgets: (month?: string) =>
    request<BudgetOverview>(`/budgets${month ? `?month=${month}` : ''}`),

  setBudget: (payload: { category_id: string; amount: number; month?: string }) =>
    request<{ message: string; budget: unknown }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteBudget: (id: string) =>
    request<{ message: string }>(`/budgets/${id}`, {
      method: 'DELETE',
    }),

  // Recurring Transactions
  getRecurring: () =>
    request<{ recurring: RecurringTransaction[] }>('/recurring'),

  createRecurring: (payload: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    start_date?: string;
  }) =>
    request<{ recurring: RecurringTransaction }>('/recurring', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleRecurring: (id: string) =>
    request<{ message: string; is_active: boolean }>(`/recurring/${id}/toggle`, {
      method: 'PUT',
    }),

  deleteRecurring: (id: string) =>
    request<{ message: string }>(`/recurring/${id}`, {
      method: 'DELETE',
    }),

  processDueRecurring: () =>
    request<{ message: string; created_transactions: number }>('/recurring/process', {
      method: 'POST',
    }),

  // Analytics
  getSummary: (period: string = 'all', from?: string, to?: string, account_id?: string) => {
    const query = new URLSearchParams({ period });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    return request<SummaryData>(`/analytics/summary?${query.toString()}`);
  },

  getCategoryBreakdown: (type: 'income' | 'expense' = 'expense', period: string = 'this_month', account_id?: string) => {
    const query = new URLSearchParams({ type, period });
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    return request<{ type: string; period: string; total: number; breakdowns: CategoryBreakdown[] }>(
      `/analytics/categories?${query.toString()}`
    );
  },

  getMonthlyTrends: (account_id?: string) => {
    const query = new URLSearchParams();
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    const qs = query.toString();
    return request<{ trends: MonthlyTrend[] }>(`/analytics/trends${qs ? `?${qs}` : ''}`);
  },

  // Backup & Restore
  exportBackup: () =>
    request<BackupPayload>('/backup/export'),

  importBackup: (payload: BackupPayload) =>
    request<{ message: string; restored_transactions: number; restored_categories: number }>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  recordBackupLog: (payload: { file_id: string; file_name: string; record_size: number }) =>
    request<{ backup_log: BackupLog }>('/backup/log', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBackupHistory: () =>
    request<{ backups: BackupLog[] }>('/backup/history'),
};

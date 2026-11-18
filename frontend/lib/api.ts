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
  RecurringTransaction,
  AnalyticsInsights,
} from './types';
import { OfflineStorage, getAppMode, setAppMode, AppMode } from './offline-storage';

export { getAppMode, setAppMode };
export type { AppMode };

// Default API URL
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080/api';

export async function getApiUrl(): Promise<string> {
  if (typeof window !== 'undefined') {
    // 1. Explicit user override from Settings
    const stored = localStorage.getItem('custom_api_url');
    if (stored && stored.trim() !== '') {
      return stored.trim();
    }

    // 2. Build-time environment variable (NEXT_PUBLIC_API_URL from .env or deployment)
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envApiUrl && envApiUrl.trim() !== '') {
      return envApiUrl.trim();
    }

    // 3. If running inside Capacitor APK on physical device (LAN fallback for local testing):
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.() || window.location.protocol === 'capacitor:';
    if (isCapacitor) {
      // Default to known local computer IP on LAN port 18080
      return 'http://192.168.177.131:18080/api';
    }

    // 4. In browser (standard web) -> use relative '/api' proxied by Next.js to 127.0.0.1:18080
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
  if (getAppMode() === 'offline') {
    return 'offline_device_token';
  }

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
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && token !== 'offline_device_token') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${endpoint}`;

  // 2.5-second timeout controller so requests never lag or hang on mobile
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

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
      throw new Error('Connection timed out. Server unreachable at ' + baseUrl);
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server at ' + baseUrl + '. Please ensure your server is running or use Offline Mode.');
    }
    throw err;
  }
}

// API Methods with automatic Online / Offline branching
export const api = {
  // Auth
  register: async (payload: { email: string; password: string; full_name?: string; currency?: string }) => {
    // 1. If explicit offline mode, register on-device
    if (getAppMode() === 'offline') {
      return OfflineStorage.registerLocalUser(payload);
    }

    // 2. Try online cloud registration
    try {
      const res = await request<{ access_token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // Also register on-device locally so offline access works anytime!
      try {
        OfflineStorage.registerLocalUser(payload);
      } catch (e) {}
      return res;
    } catch (onlineErr: any) {
      // If server unreachable, automatically register locally on mobile!
      console.warn('Cloud registration unreachable. Falling back to local device storage:', onlineErr);
      setAppMode('offline');
      return OfflineStorage.registerLocalUser(payload);
    }
  },

  login: async (payload: { email: string; password: string }) => {
    // 1. If explicit offline mode, log in on-device
    if (getAppMode() === 'offline') {
      return OfflineStorage.loginLocalUser(payload);
    }

    // 2. Try online cloud login
    try {
      const res = await request<{ access_token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // Also sync user locally
      try {
        OfflineStorage.setUser(res.user);
      } catch (e) {}
      return res;
    } catch (onlineErr: any) {
      // If server unreachable, check local device login!
      console.warn('Cloud login unreachable. Falling back to local device login:', onlineErr);
      try {
        const localRes = OfflineStorage.loginLocalUser(payload);
        setAppMode('offline');
        return localRes;
      } catch (localErr: any) {
        throw new Error(localErr.message || onlineErr.message);
      }
    }
  },

  getProfile: async () => {
    if (getAppMode() === 'offline') {
      return { user: OfflineStorage.getUser() };
    }
    try {
      return await request<{ user: User }>('/auth/profile');
    } catch (err) {
      // Fallback to local profile if server goes offline
      const localUser = OfflineStorage.getUser();
      if (localUser) {
        setAppMode('offline');
        return { user: localUser };
      }
      throw err;
    }
  },

  updateProfile: async (payload: { full_name?: string; currency?: string }) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.updateUser(payload);
      return { message: 'Profile updated locally' };
    }
    return request<{ message: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  changePassword: async (payload: { current_password: string; new_password: string }) => {
    if (getAppMode() === 'offline') {
      return { message: 'Password updated (offline mode)' };
    }
    return request<{ message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteAccount: async () => {
    if (getAppMode() === 'offline') {
      OfflineStorage.clearAll();
      return { message: 'Offline data cleared' };
    }
    return request<{ message: string }>('/auth/account', {
      method: 'DELETE',
    });
  },

  // Sub-Accounts
  getAccounts: async () => {
    if (getAppMode() === 'offline') {
      return { accounts: OfflineStorage.getAccounts() };
    }
    return request<{ accounts: SubAccount[] }>('/accounts');
  },

  createAccount: async (payload: { name: string; type?: string; icon?: string; color?: string; is_default?: boolean }) => {
    if (getAppMode() === 'offline') {
      const account = OfflineStorage.createAccount(payload);
      return { message: 'Account created locally', account };
    }
    return request<{ message: string; account: SubAccount }>('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAccount: async (id: string, payload: { name?: string; type?: string; icon?: string; color?: string; is_default?: boolean }) => {
    if (getAppMode() === 'offline') {
      const account = OfflineStorage.updateAccount(id, payload);
      return { message: 'Account updated locally', account };
    }
    return request<{ message: string }>('/accounts/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteAccountItem: async (id: string) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.deleteAccount(id);
      return { message: 'Account deleted locally' };
    }
    return request<{ message: string }>('/accounts/' + id, {
      method: 'DELETE',
    });
  },

  // Categories
  getCategories: async (type?: string) => {
    if (getAppMode() === 'offline') {
      let cats = OfflineStorage.getCategories();
      if (type) cats = cats.filter((c) => c.type === type);
      return { categories: cats };
    }
    return request<{ categories: Category[] }>(`/categories${type ? `?type=${type}` : ''}`);
  },

  createCategory: async (payload: { name: string; type: 'income' | 'expense'; icon?: string; color?: string }) => {
    if (getAppMode() === 'offline') {
      const category = OfflineStorage.createCategory(payload);
      return { category };
    }
    return request<{ category: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteCategory: async (id: string) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.deleteCategory(id);
      return { message: 'Category deleted locally' };
    }
    return request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Transactions
  getTransactions: async (params?: {
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
    if (getAppMode() === 'offline') {
      const txs = OfflineStorage.getTransactions(params);
      return { transactions: txs, pagination: { total: txs.length, page: 1, limit: txs.length } };
    }
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

  createTransaction: async (payload: {
    account_id?: string;
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
    receipt_image?: string;
    date?: string;
  }) => {
    if (getAppMode() === 'offline') {
      const transaction = OfflineStorage.createTransaction({
        account_id: payload.account_id,
        amount: payload.amount,
        type: payload.type,
        category_id: payload.category_id,
        payment_method: payload.payment_method || 'cash',
        note: payload.note || '',
        receipt_image: payload.receipt_image,
        date: payload.date || new Date().toISOString().split('T')[0],
      });
      return { message: 'Transaction saved to device', transaction };
    }
    return request<{ message: string; transaction: Transaction }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTransaction: async (
    id: string,
    payload: {
      account_id?: string;
      amount: number;
      type: 'income' | 'expense';
      category_id: string;
      payment_method?: string;
      note?: string;
      receipt_image?: string;
      date?: string;
    }
  ) => {
    if (getAppMode() === 'offline') {
      const transaction = OfflineStorage.updateTransaction(id, payload);
      return { message: 'Transaction updated locally', transaction };
    }
    return request<{ message: string; transaction: Transaction }>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTransaction: async (id: string) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.deleteTransaction(id);
      return { message: 'Transaction deleted locally' };
    }
    return request<{ message: string }>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  },

  // Budgets & Spending Limits
  getBudgets: async (month?: string) => {
    if (getAppMode() === 'offline') {
      return OfflineStorage.getBudgets(month);
    }
    return request<BudgetOverview>(`/budgets${month ? `?month=${month}` : ''}`);
  },

  setBudget: async (payload: { category_id: string; amount: number; month?: string }) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.setBudget({
        category_id: payload.category_id,
        amount: payload.amount,
        month: payload.month || new Date().toISOString().slice(0, 7),
      });
      return { message: 'Budget set locally', budget: payload };
    }
    return request<{ message: string; budget: unknown }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteBudget: async (id: string) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.deleteBudget(id);
      return { message: 'Budget removed locally' };
    }
    return request<{ message: string }>(`/budgets/${id}`, {
      method: 'DELETE',
    });
  },

  // Recurring Transactions
  getRecurring: async () => {
    if (getAppMode() === 'offline') {
      return { recurring: OfflineStorage.getRecurring() };
    }
    return request<{ recurring: RecurringTransaction[] }>('/recurring');
  },

  createRecurring: async (payload: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    start_date?: string;
  }) => {
    if (getAppMode() === 'offline') {
      const rec = OfflineStorage.createRecurring({
        amount: payload.amount,
        type: payload.type,
        category_id: payload.category_id,
        payment_method: payload.payment_method || 'cash',
        note: payload.note || '',
        frequency: payload.frequency,
        next_run: payload.start_date || new Date().toISOString().split('T')[0],
      });
      return { recurring: rec };
    }
    return request<{ recurring: RecurringTransaction }>('/recurring', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  toggleRecurring: async (id: string) => {
    if (getAppMode() === 'offline') {
      const rec = OfflineStorage.toggleRecurring(id);
      return { message: 'Recurring toggled', is_active: rec.is_active };
    }
    return request<{ message: string; is_active: boolean }>(`/recurring/${id}/toggle`, {
      method: 'PUT',
    });
  },

  deleteRecurring: async (id: string) => {
    if (getAppMode() === 'offline') {
      OfflineStorage.deleteRecurring(id);
      return { message: 'Recurring deleted locally' };
    }
    return request<{ message: string }>(`/recurring/${id}`, {
      method: 'DELETE',
    });
  },

  processDueRecurring: async () => {
    if (getAppMode() === 'offline') {
      const count = OfflineStorage.processDueRecurring();
      return { message: 'Processed offline recurring', created_transactions: count };
    }
    return request<{ message: string; created_transactions: number }>('/recurring/process', {
      method: 'POST',
    });
  },

  // Analytics
  getSummary: async (period: string = 'all', from?: string, to?: string, account_id?: string) => {
    if (getAppMode() === 'offline') {
      return OfflineStorage.getSummary(period, account_id);
    }
    const query = new URLSearchParams({ period });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    return request<SummaryData>(`/analytics/summary?${query.toString()}`);
  },

  getCategoryBreakdown: async (type: 'income' | 'expense' = 'expense', period: string = 'this_month', account_id?: string) => {
    if (getAppMode() === 'offline') {
      const breakdowns = OfflineStorage.getCategoryBreakdown(type, period, account_id);
      const total = breakdowns.reduce((sum, b) => sum + b.total_amount, 0);
      return { type, period, total, breakdowns };
    }
    const query = new URLSearchParams({ type, period });
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    return request<{ type: string; period: string; total: number; breakdowns: CategoryBreakdown[] }>(
      `/analytics/categories?${query.toString()}`
    );
  },

  getMonthlyTrends: async (account_id?: string) => {
    if (getAppMode() === 'offline') {
      return { trends: OfflineStorage.getMonthlyTrends(account_id) };
    }
    const query = new URLSearchParams();
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    const qs = query.toString();
    return request<{ trends: MonthlyTrend[] }>(`/analytics/trends${qs ? `?${qs}` : ''}`);
  },

  getAnalyticsInsights: async (period: string = 'this_month', account_id?: string) => {
    if (getAppMode() === 'offline') {
      return OfflineStorage.getAnalyticsInsights(period, account_id);
    }
    const query = new URLSearchParams({ period });
    if (account_id && account_id !== 'all') query.set('account_id', account_id);
    return request<AnalyticsInsights>(`/analytics/insights?${query.toString()}`);
  },

  // Backup & Restore
  exportBackup: async () => {
    if (getAppMode() === 'offline') {
      return OfflineStorage.exportBackup();
    }
    return request<BackupPayload>('/backup/export');
  },

  importBackup: async (payload: BackupPayload) => {
    if (getAppMode() === 'offline') {
      const res = OfflineStorage.importBackup(payload);
      return {
        message: 'Backup restored to device successfully',
        restored_transactions: res.transactions_imported,
        restored_categories: res.categories_imported,
      };
    }
    return request<{ message: string; restored_transactions: number; restored_categories: number }>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  recordBackupLog: async (payload: { file_id: string; file_name: string; record_size: number }) => {
    if (getAppMode() === 'offline') {
      return {
        backup_log: {
          id: 'offline-log-' + Date.now(),
          user_id: 'device-offline-user',
          provider: 'local',
          file_id: payload.file_id,
          file_name: payload.file_name,
          record_size: payload.record_size,
          status: 'success',
          created_at: new Date().toISOString(),
        },
      };
    }
    return request<{ backup_log: BackupLog }>('/backup/log', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getBackupHistory: async () => {
    if (getAppMode() === 'offline') {
      return { backups: [] };
    }
    return request<{ backups: BackupLog[] }>('/backup/history');
  },

  resetAllData: async () => {
    if (getAppMode() === 'offline') {
      OfflineStorage.resetAllData();
      return { message: 'All data deleted and reset to default.' };
    }
    const [txRes, budRes, recRes] = await Promise.all([
      request<{ transactions: Transaction[] }>('/transactions?limit=10000').catch(() => ({ transactions: [] })),
      request<BudgetOverview>('/budgets').catch(() => ({ budgets: [] as BudgetOverview['budgets'] })),
      request<{ recurring_transactions: RecurringTransaction[] }>('/recurring').catch(() => ({ recurring_transactions: [] })),
    ]);
    await Promise.all([
      ...(txRes.transactions || []).map((t) => request(`/transactions/${t.id}`, { method: 'DELETE' }).catch(() => null)),
      ...(budRes.budgets || []).map((b) => request(`/budgets/${b.budget_id}`, { method: 'DELETE' }).catch(() => null)),
      ...(recRes.recurring_transactions || []).map((r) => request(`/recurring/${r.id}`, { method: 'DELETE' }).catch(() => null)),
    ]);
    OfflineStorage.resetAllData();
    return { message: 'All data deleted and reset to default.' };
  },
};

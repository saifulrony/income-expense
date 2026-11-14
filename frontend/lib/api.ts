import { Preferences } from '@capacitor/preferences';
import { 
  User, 
  Category, 
  Transaction, 
  SummaryData, 
  CategoryBreakdown, 
  MonthlyTrend, 
  BackupPayload, 
  BackupLog 
} from './types';

// Default API URL (can be customized via localStorage for mobile testing against physical device IP)
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export async function getApiUrl(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: 'custom_api_url' });
    if (value) return value;
  } catch (e) {
    // fallback
  }
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('custom_api_url');
    if (stored) return stored;
  }
  return DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  try {
    await Preferences.set({ key: 'custom_api_url', value: url });
  } catch (e) {}
  if (typeof window !== 'undefined') {
    localStorage.setItem('custom_api_url', url);
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: 'auth_token' });
    if (value) return value;
  } catch (e) {}
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

export async function setAuthToken(token: string): Promise<void> {
  try {
    await Preferences.set({ key: 'auth_token', value: token });
  } catch (e) {}
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export async function removeAuthToken(): Promise<void> {
  try {
    await Preferences.remove({ key: 'auth_token' });
  } catch (e) {}
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
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
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
  }

  return data as T;
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
    if (params?.type) query.set('type', params.type);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.payment_method) query.set('payment_method', params.payment_method);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    return request<{ transactions: Transaction[]; pagination: any }>(`/transactions${qs ? `?${qs}` : ''}`);
  },

  createTransaction: (payload: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
    date?: string;
  }) =>
    request<{ message: string; transaction: Transaction }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTransaction: (id: string, payload: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method?: string;
    note?: string;
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

  // Analytics
  getSummary: (period: string = 'all', from?: string, to?: string) => {
    const query = new URLSearchParams({ period });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return request<SummaryData>(`/analytics/summary?${query.toString()}`);
  },

  getCategoryBreakdown: (type: 'income' | 'expense' = 'expense', period: string = 'this_month') =>
    request<{ type: string; period: string; total: number; breakdowns: CategoryBreakdown[] }>(
      `/analytics/categories?type=${type}&period=${period}`
    ),

  getMonthlyTrends: () =>
    request<{ trends: MonthlyTrend[] }>('/analytics/trends'),

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

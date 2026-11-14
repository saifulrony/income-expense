export type TransactionType = 'income' | 'expense';

export interface User {
  id: string;
  email: string;
  full_name: string;
  currency: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  category: Category;
  payment_method: string;
  note: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryData {
  total_income: number;
  total_expense: number;
  net_balance: number;
  income_count: number;
  expense_count: number;
  total_count: number;
  period: string;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  type: string;
  color: string;
  icon: string;
  total_amount: number;
  percentage: number;
  count: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface BackupPayload {
  version: string;
  exported_at: string;
  user_email: string;
  currency: string;
  categories: Category[];
  transactions: Transaction[];
}

export interface BackupLog {
  id: string;
  user_id: string;
  provider: string;
  file_id: string;
  file_name: string;
  record_size: number;
  status: string;
  created_at: string;
}

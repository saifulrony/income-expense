export type TransactionType = 'income' | 'expense';

export interface SubAccount {
  id: string;
  user_id: string;
  name: string; // e.g. "Personal", "Family", "Business"
  type: string; // personal, family, business, savings
  icon: string;
  color: string;
  is_default: boolean;
  total_income: number;
  total_expense: number;
  balance: number;
  transaction_count: number;
  created_at: string;
}

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
  account_id?: string;
  account?: SubAccount;
  amount: number;
  type: TransactionType;
  category_id: string;
  category: Category;
  payment_method: string;
  note: string;
  receipt_image?: string;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface BudgetStatusItem {
  budget_id: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  budget_limit: number;
  actual_spent: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
  month: string;
}

export interface BudgetOverview {
  month: string;
  total_budget: number;
  total_spent: number;
  remaining: number;
  percentage: number;
  budgets: BudgetStatusItem[];
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  category: Category;
  payment_method: string;
  note: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  next_run: string;
  is_active: boolean;
  created_at: string;
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

export interface PaymentMethodStat {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface DayOfWeekStat {
  day: string;
  day_num: number;
  expense: number;
  income: number;
  count: number;
}

export interface TopExpenseItem {
  id: string;
  amount: number;
  type: string;
  note: string;
  date: string;
  category_name: string;
  color: string;
  icon: string;
}

export interface AnalyticsInsights {
  savings_rate: number;
  savings_health: 'High' | 'Healthy' | 'Modest' | 'Deficit' | 'Neutral';
  daily_average_expense: number;
  daily_average_income: number;
  projected_month_expense: number;
  days_elapsed: number;
  days_in_period: number;
  expense_diff_pct: number;
  income_diff_pct: number;
  payment_methods: PaymentMethodStat[];
  day_of_week_stats: DayOfWeekStat[];
  peak_spending_day: string;
  top_expenses: TopExpenseItem[];
}

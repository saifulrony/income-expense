'use client';

import React, { useState } from 'react';
import { SubAccount } from '@/lib/types';
import { api } from '@/lib/api';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  User, 
  Users, 
  Briefcase, 
  Heart, 
  Home, 
  ShoppingBag, 
  PiggyBank,
  Wallet,
  ShieldCheck,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: SubAccount[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onRefresh: () => void;
  currency: string;
}

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  User: <User className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  ShoppingBag: <ShoppingBag className="w-4 h-4" />,
  PiggyBank: <PiggyBank className="w-4 h-4" />,
  Wallet: <Wallet className="w-4 h-4" />,
};

const ACCOUNT_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

export default function AccountManagerModal({
  isOpen,
  onClose,
  accounts,
  activeAccountId,
  onSelectAccount,
  onRefresh,
  currency,
}: AccountManagerModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('personal');
  const [selectedIcon, setSelectedIcon] = useState('User');
  const [selectedColor, setSelectedColor] = useState('#10B981');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.createAccount({
        name: name.trim(),
        type,
        icon: selectedIcon,
        color: selectedColor,
        is_default: isDefault,
      });

      setName('');
      setIsCreating(false);
      onSelectAccount(res.account.id);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (account: SubAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      alert('You must have at least one account.');
      return;
    }

    if (
      confirm(
        `Delete account "${account.name}"? Any existing transactions will safely merge into your default account.`
      )
    ) {
      try {
        await api.deleteAccountItem(account.id);
        if (activeAccountId === account.id) {
          const fallback = accounts.find((a) => a.id !== account.id);
          if (fallback) onSelectAccount(fallback.id);
        }
        onRefresh();
      } catch (err: any) {
        alert(err.message || 'Failed to delete account');
      }
    }
  };

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Accounts & Ledgers
              </h2>
              <p className="text-xs text-slate-400">
                Separate Personal, Family & Business records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Option to view Consolidated All Accounts */}
        <div
          onClick={() => {
            onSelectAccount('all');
            onClose();
          }}
          className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
            activeAccountId === 'all'
              ? 'bg-slate-900 text-white dark:bg-emerald-950/70 dark:border-emerald-600 border-slate-900 shadow-md'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-200/50 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">Consolidated (All Accounts)</div>
              <div className="text-xs opacity-75">Combined Net Balance & Flow</div>
            </div>
          </div>
          {activeAccountId === 'all' && (
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>

        {/* Existing Accounts List */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Your Sub-Accounts
          </div>

          {accounts.map((acc) => {
            const isSelected = activeAccountId === acc.id;
            return (
              <div
                key={acc.id}
                onClick={() => {
                  onSelectAccount(acc.id);
                  onClose();
                }}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800/80 border-slate-100 dark:border-slate-800 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                    style={{ backgroundColor: acc.color }}
                  >
                    {ACCOUNT_ICONS[acc.icon] || <Wallet className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {acc.name}
                      </span>
                      {acc.is_default && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded font-semibold uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 capitalize">
                      {acc.type} • {acc.transaction_count || 0} entries
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div
                      className={`text-xs font-mono font-bold ${
                        (acc.balance || 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {(acc.balance || 0) >= 0 ? '' : '-'}
                      {currency} {formatAmount(Math.abs(acc.balance || 0))}
                    </div>
                    <div className="text-xs text-slate-400">Balance</div>
                  </div>

                  {accounts.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(acc, e)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Account Form Toggle */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Account (e.g. Family, Business)</span>
          </button>
        ) : (
          <form
            onSubmit={handleCreate}
            className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                New Sub-Account
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Account Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Family, Home Expenses, Side Gig"
                className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Account Classification
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none"
              >
                <option value="personal">Personal</option>
                <option value="family">Family / Household</option>
                <option value="business">Business / Freelance</option>
                <option value="savings">Savings / Investment</option>
                <option value="other">Other / Shared</option>
              </select>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Badge Icon
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {Object.keys(ACCOUNT_ICONS).map((iconKey) => (
                  <button
                    key={iconKey}
                    type="button"
                    onClick={() => setSelectedIcon(iconKey)}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
                      selectedIcon === iconKey
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {ACCOUNT_ICONS[iconKey]}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Account Color
              </label>
              <div className="flex gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform active:scale-90"
                    style={{
                      backgroundColor: c,
                      borderColor: selectedColor === c ? '#0f172a' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


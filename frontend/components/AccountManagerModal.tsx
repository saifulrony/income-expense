'use client';

import React, { useState } from 'react';
import { SubAccount } from '@/lib/types';
import { api } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
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
  const symbol = getCurrencySymbol(currency);
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Smooth Bottom Sheet Container */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[14px] sm:rounded-[10px] shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 p-5 max-h-[88vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-250 z-10">
        
        {/* Mobile Grab Handle Bar */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Accounts & Ledgers
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Separate Personal, Family & Business records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Option: Consolidated All Accounts */}
        <div className="mt-3.5 space-y-2">
          <div
            onClick={() => {
              onSelectAccount('all');
              onClose();
            }}
            className={`p-3 rounded-[10px] border cursor-pointer transition-all flex items-center justify-between ${
              activeAccountId === 'all'
                ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 shadow-xs'
                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  All Accounts (Consolidated)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Combined net flow across all ledgers
                </div>
              </div>
            </div>

            {/* Radio Checkmark Circle */}
            <div className="shrink-0 ml-3">
              {activeAccountId === 'all' ? (
                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
              )}
            </div>
          </div>

          {/* 2. Existing Accounts List */}
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 block mb-2">
              Individual Ledgers
            </span>

            <div className="space-y-2">
              {accounts.map((acc) => {
                const isSelected = activeAccountId === acc.id;
                const accBalance = acc.balance || 0;

                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      onSelectAccount(acc.id);
                      onClose();
                    }}
                    className={`p-3 rounded-[10px] border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: acc.color }}
                      >
                        {ACCOUNT_ICONS[acc.icon] || <Wallet className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {acc.name}
                          </span>
                          {acc.is_default && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize truncate">
                          {acc.type} • {acc.transaction_count || 0} entries
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      {/* Live Ledger Balance */}
                      <div className="text-right">
                        <div
                          className={`text-xs font-mono font-bold ${
                            accBalance >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {accBalance < 0 ? '-' : '+'}{symbol}{formatAmount(Math.abs(accBalance))}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          Balance
                        </div>
                      </div>

                      {/* Radio Checkmark Circle */}
                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                        )}
                      </div>

                      {/* Delete account button (if more than 1) */}
                      {accounts.length > 1 && (
                        <button
                          onClick={(e) => handleDelete(acc, e)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                          title="Delete account"
                          aria-label={`Delete ${acc.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Create Account Form / Button */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Account (e.g. Family, Business)</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreate}
              className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-[10px] border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  New Sub-Account
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Family, Freelance, Side Gig"
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Classification
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
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
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Badge Icon
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {Object.keys(ACCOUNT_ICONS).map((iconKey) => (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setSelectedIcon(iconKey)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                        selectedIcon === iconKey
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shadow-xs'
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
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
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
                  className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatAmount } from '@/lib/currency';
import { useFlowLabels } from '@/lib/ui-prefs';
import { useTranslation } from '@/lib/i18n';
import {
  Calculator,
  RotateCcw,
  Copy,
  Check,
  Plus,
  Minus,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  X,
} from 'lucide-react';

interface CashCalculatorViewProps {
  currency: string;
  onRecordCash?: (type: 'income' | 'expense', amount: number, breakdownNote: string) => void;
  onBack?: () => void;
}

const DEFAULT_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
const STORAGE_KEY_COUNTS = 'cashflow_cash_calc_counts';
const STORAGE_KEY_CUSTOM_DENOMS = 'cashflow_cash_calc_custom_denoms';

export default function CashCalculatorView({
  currency,
  onRecordCash,
  onBack,
}: CashCalculatorViewProps) {
  const { inLabel, outLabel } = useFlowLabels();
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [customDenoms, setCustomDenoms] = useState<number[]>([]);
  const [showAddDenom, setShowAddDenom] = useState(false);
  const [newDenomInput, setNewDenomInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Load persisted counts & custom denominations on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedCounts = localStorage.getItem(STORAGE_KEY_COUNTS);
      if (savedCounts) setCounts(JSON.parse(savedCounts));
      const savedDenoms = localStorage.getItem(STORAGE_KEY_CUSTOM_DENOMS);
      if (savedDenoms) setCustomDenoms(JSON.parse(savedDenoms));
    } catch {}
  }, []);

  const saveCounts = (next: Record<number, string>) => {
    setCounts(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_COUNTS, JSON.stringify(next));
      } catch {}
    }
  };

  const denominations = useMemo(() => {
    const merged = Array.from(new Set([...DEFAULT_DENOMINATIONS, ...customDenoms]));
    merged.sort((a, b) => b - a);
    return merged;
  }, [customDenoms]);

  const rows = useMemo(() => {
    return denominations.map((denom) => {
      const raw = counts[denom] ?? '';
      const qty = Math.max(0, parseInt(raw, 10) || 0);
      const subtotal = qty * denom;
      return { denom, raw, qty, subtotal };
    });
  }, [denominations, counts]);

  const { grandTotal, totalNotes, activeRows } = useMemo(() => {
    let total = 0;
    let notes = 0;
    const active: typeof rows = [];
    for (const r of rows) {
      if (r.qty > 0) {
        total += r.subtotal;
        notes += r.qty;
        active.push(r);
      }
    }
    return { grandTotal: total, totalNotes: notes, activeRows: active };
  }, [rows]);

  const breakdownNote = useMemo(() => {
    if (activeRows.length === 0) return '';
    return 'Cash: ' + activeRows.map((r) => `${r.qty}×${r.denom}`).join(', ');
  }, [activeRows]);

  const handleCountChange = (denom: number, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const next = { ...counts };
    if (!cleaned || parseInt(cleaned, 10) === 0) {
      delete next[denom];
    } else {
      next[denom] = cleaned;
    }
    saveCounts(next);
  };

  const handleStep = (denom: number, delta: number) => {
    const current = Math.max(0, parseInt(counts[denom] ?? '0', 10) || 0);
    const updated = Math.max(0, current + delta);
    handleCountChange(denom, updated > 0 ? String(updated) : '');
  };

  const handleReset = () => {
    saveCounts({});
  };

  const handleAddCustomDenom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newDenomInput.trim(), 10);
    if (!val || val <= 0) return;
    if (!denominations.includes(val)) {
      const nextCustom = [...customDenoms, val];
      setCustomDenoms(nextCustom);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CUSTOM_DENOMS, JSON.stringify(nextCustom));
      }
    }
    setNewDenomInput('');
    setShowAddDenom(false);
  };

  const handleRemoveCustomDenom = (denom: number) => {
    const nextCustom = customDenoms.filter((d) => d !== denom);
    setCustomDenoms(nextCustom);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOM_DENOMS, JSON.stringify(nextCustom));
    }
    const nextCounts = { ...counts };
    delete nextCounts[denom];
    saveCounts(nextCounts);
  };

  const handleCopyBreakdown = async () => {
    if (activeRows.length === 0) return;
    const lines = activeRows.map(
      (r) => `${r.qty} × ${currency}${r.denom} = ${currency}${formatAmount(r.subtotal)}`
    );
    lines.push(`Total (${totalNotes} notes) = ${currency}${formatAmount(grandTotal)}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="space-y-3.5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
            <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{t('cashCalculator')}</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddDenom(!showAddDenom)}
            className="px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold whitespace-nowrap flex items-center gap-1 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('addNote')}</span>
          </button>

          {grandTotal > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('reset')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Add Custom Denomination Input */}
      {showAddDenom && (
        <form
          onSubmit={handleAddCustomDenom}
          className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2 shadow-xs animate-in fade-in duration-150"
        >
          <Coins className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="number"
            min="1"
            value={newDenomInput}
            onChange={(e) => setNewDenomInput(e.target.value)}
            placeholder="Custom note value (e.g. 2000)"
            autoFocus
            className="flex-1 px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowAddDenom(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Grand Total Summary Cockpit */}
      <div className="p-4 rounded-[10px] border bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/50 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70 dark:text-emerald-300/80 block">
              {t('totalCashValue')}
            </span>
            <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 tracking-tight mt-0.5">
              <span className="currency-symbol">{currency}</span>
              {formatAmount(grandTotal)}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-white/80 dark:bg-slate-900/70 border border-emerald-200/70 dark:border-emerald-800/60 text-slate-700 dark:text-slate-200">
              {totalNotes} {totalNotes === 1 ? 'Note' : 'Notes'}
            </span>
            {activeRows.length > 0 && (
              <button
                type="button"
                onClick={handleCopyBreakdown}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>{t('copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t('copyBreakdown')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Live Expression Pill Strip (e.g. 1×1000, 3×500) */}
        {activeRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40">
            {activeRows.map((r) => (
              <span
                key={r.denom}
                className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white/90 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
              >
                {r.qty}×{r.denom} = {currency}{formatAmount(r.subtotal)}
              </span>
            ))}
          </div>
        )}

        {/* Quick Record as Cash In / Cash Out */}
        {grandTotal > 0 && onRecordCash && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onRecordCash('income', grandTotal, breakdownNote)}
              className="py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">Record {inLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => onRecordCash('expense', grandTotal, breakdownNote)}
              className="py-2 px-3 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all"
            >
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">Record {outLabel}</span>
            </button>
          </div>
        )}
      </div>

      {/* Denomination Multiplier Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
        <div className="px-3.5 py-2 bg-slate-50/80 dark:bg-slate-900/50 grid grid-cols-12 items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="col-span-4">{t('noteCoin')}</span>
          <span className="col-span-4 text-center">{t('countQty')}</span>
          <span className="col-span-4 text-right">{t('amount')}</span>
        </div>

        {rows.map(({ denom, raw, qty, subtotal }) => {
          const isActive = qty > 0;
          const isCustom = !DEFAULT_DENOMINATIONS.includes(denom);

          return (
            <div
              key={denom}
              className={`px-3.5 py-2.5 grid grid-cols-12 items-center gap-2 transition-colors ${
                isActive ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
              }`}
            >
              {/* Left: Denomination Label */}
              <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                <div
                  className={`px-2 py-1 rounded-md font-mono text-xs font-bold border whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700'
                  }`}
                >
                  <span className="currency-symbol mr-0.5">{currency}</span>
                  {denom.toLocaleString()}
                </div>
                <span className="text-xs font-bold text-slate-400">×</span>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomDenom(denom)}
                    className="text-slate-300 hover:text-rose-500 p-0.5"
                    title="Remove custom note"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Center: Stepper + Count Input */}
              <div className="col-span-4 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStep(denom, -1)}
                  disabled={qty === 0}
                  className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                  aria-label={`Decrease ${denom} count`}
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="text"
                  inputMode="numeric"
                  value={raw}
                  onChange={(e) => handleCountChange(denom, e.target.value)}
                  placeholder="0"
                  className={`w-12 h-7 rounded-md border text-center font-mono text-xs font-bold outline-none transition-colors ${
                    isActive
                      ? 'border-emerald-500 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleStep(denom, 1)}
                  className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-all shrink-0"
                  aria-label={`Increase ${denom} count`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Right: Subtotal */}
              <div className="col-span-4 text-right font-mono">
                <span
                  className={`text-xs font-bold ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span className="currency-symbol">{currency}</span>
                  {formatAmount(subtotal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


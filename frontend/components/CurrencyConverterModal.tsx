'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowRightLeft, Coins } from 'lucide-react';
import { CURRENCY_RATES, convertCurrency } from '@/lib/currency';

interface CurrencyConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCurrency: string;
}

export default function CurrencyConverterModal({
  isOpen,
  onClose,
  defaultCurrency,
}: CurrencyConverterModalProps) {
  const [amount, setAmount] = useState('100');
  const [fromCurr, setFromCurr] = useState(defaultCurrency || 'USD');
  const [toCurr, setToCurr] = useState('BDT');

  // Swipe-down to close for bottom sheet on mobile
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isVerticalDragRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      isVerticalDragRef.current = null;
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isVerticalDragRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t || isVerticalDragRef.current === false) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (isVerticalDragRef.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isVerticalDragRef.current = Math.abs(dy) > Math.abs(dx) && dy > 0;
      if (isVerticalDragRef.current) {
        setIsDragging(true);
      }
    }

    if (isVerticalDragRef.current) {
      setDragY(Math.max(0, dy));
    }
  };

  const handleTouchEnd = () => {
    if (!isVerticalDragRef.current) {
      setIsDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragY / elapsed;
    const shouldClose = dragY > 80 || velocity > 0.4;

    setIsDragging(false);
    setDragY(0);
    isVerticalDragRef.current = null;

    if (shouldClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const converted = convertCurrency(numAmount, fromCurr, toCurr);
  const oneUnitRate = convertCurrency(1, fromCurr, toCurr);

  const swapCurrencies = () => {
    const temp = fromCurr;
    setFromCurr(toCurr);
    setToCurr(temp);
  };

  const currencyOptions = Object.values(CURRENCY_RATES);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 transition-opacity animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={
          isDragging
            ? {
                transform: `translate3d(0, ${dragY}px, 0)`,
                transition: 'none',
              }
            : undefined
        }
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[14px] sm:rounded-[10px] shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-150 gpu-layer will-change-transform"
      >
        {/* Top Drag Handle for Bottom Sheet */}
        <div className="sm:hidden flex justify-center -mt-3 mb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Multi-Currency Calculator
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              Amount to Convert
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 text-lg font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-5 gap-2 items-center">
            <div className="col-span-2">
              <label className="text-xs uppercase font-bold text-slate-400 block mb-1">From</label>
              <select
                value={fromCurr}
                onChange={(e) => setFromCurr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
              >
                {currencyOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag ? c.flag + ' ' : ''}{c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={swapCurrencies}
                className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                title="Swap"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="col-span-2">
              <label className="text-xs uppercase font-bold text-slate-400 block mb-1">To</label>
              <select
                value={toCurr}
                onChange={(e) => setToCurr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
              >
                {currencyOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag ? c.flag + ' ' : ''}{c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Card */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-[10px] text-center space-y-1">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Converted Result
            </span>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {CURRENCY_RATES[toCurr]?.symbol}{converted.toFixed(2)}
            </div>
            <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 pt-1">
              Rate: 1 {CURRENCY_RATES[fromCurr]?.symbol || fromCurr} = {CURRENCY_RATES[toCurr]?.symbol || toCurr}{oneUnitRate.toFixed(4)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


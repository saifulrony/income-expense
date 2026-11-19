'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Delete, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

export type PinModalMode = 'setup' | 'change' | 'disable';

interface PinSetupModalProps {
  isOpen: boolean;
  mode: PinModalMode;
  currentPin: string | null;
  onClose: () => void;
  onComplete: (newPin: string | null) => void;
}

type Step = 'verify_current' | 'enter_new' | 'confirm_new';

export default function PinSetupModal({
  isOpen,
  mode,
  currentPin,
  onClose,
  onComplete,
}: PinSetupModalProps) {
  const [step, setStep] = useState<Step>('enter_new');
  const [inputPin, setInputPin] = useState('');
  const [pendingNewPin, setPendingNewPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setInputPin('');
    setPendingNewPin('');
    setErrorMsg('');
    if (mode === 'setup') {
      setStep('enter_new');
    } else {
      setStep('verify_current');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const title =
    step === 'verify_current'
      ? mode === 'disable'
        ? 'Turn Off Security PIN'
        : 'Verify Current PIN'
      : step === 'enter_new'
      ? mode === 'change'
        ? 'Enter New PIN'
        : 'Create 4-Digit PIN'
      : 'Confirm New PIN';

  const subtitle =
    step === 'verify_current'
      ? 'Enter your current 4-digit PIN to continue'
      : step === 'enter_new'
      ? 'Choose a 4-digit PIN you will remember'
      : 'Re-enter your new 4-digit PIN to confirm';

  const handleDigit = (digit: string) => {
    if (inputPin.length >= 4) return;
    triggerHaptic('light');
    const next = inputPin + digit;
    setInputPin(next);
    setErrorMsg('');

    if (next.length === 4) {
      setTimeout(() => {
        if (step === 'verify_current') {
          if (next === currentPin) {
            triggerHaptic('success');
            if (mode === 'disable') {
              onComplete(null);
              onClose();
            } else {
              setInputPin('');
              setStep('enter_new');
            }
          } else {
            triggerHaptic('warning');
            setErrorMsg('Incorrect current PIN. Please try again.');
            setInputPin('');
          }
        } else if (step === 'enter_new') {
          if (mode === 'change' && next === currentPin) {
            triggerHaptic('warning');
            setErrorMsg('New PIN must be different from your current PIN.');
            setInputPin('');
            return;
          }
          setPendingNewPin(next);
          setInputPin('');
          setStep('confirm_new');
        } else if (step === 'confirm_new') {
          if (next === pendingNewPin) {
            triggerHaptic('success');
            onComplete(next);
            onClose();
          } else {
            triggerHaptic('warning');
            setErrorMsg('PINs did not match. Please enter your new PIN again.');
            setPendingNewPin('');
            setInputPin('');
            setStep('enter_new');
          }
        }
      }, 120);
    }
  };

  const handleBackspace = () => {
    triggerHaptic('light');
    setInputPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const stepIndex =
    mode === 'setup'
      ? step === 'enter_new'
        ? 1
        : 2
      : mode === 'change'
      ? step === 'verify_current'
        ? 1
        : step === 'enter_new'
        ? 2
        : 3
      : 1;
  const totalSteps = mode === 'change' ? 3 : mode === 'setup' ? 2 : 1;

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      className="modal-backdrop-fade fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-[18px] sm:rounded-[18px] border border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            Step {stepIndex} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close PIN modal"
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Dots */}
        <div className="px-6 pt-2 pb-5 text-center space-y-2">
          <div className={`w-11 h-11 rounded-xl mx-auto flex items-center justify-center ${
            mode === 'disable'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}>
            {step === 'confirm_new' ? <CheckCircle2 className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-400">{subtitle}</p>

          {/* 4 PIN Dots */}
          <div className="flex items-center justify-center gap-4 pt-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  errorMsg
                    ? 'bg-rose-500 scale-110'
                    : inputPin.length > i
                    ? 'bg-emerald-500 scale-110 shadow-sm shadow-emerald-500/40'
                    : 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
                }`}
              />
            ))}
          </div>

          {errorMsg ? (
            <p className="text-[11px] font-semibold text-rose-500 pt-1">{errorMsg}</p>
          ) : (
            <div className="h-4" />
          )}
        </div>

        {/* Tactile Numeric Keypad */}
        <div
          className="px-6 pb-8"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-emerald-600 active:text-white text-slate-900 dark:text-white text-lg font-bold flex items-center justify-center transition-all active:scale-95"
              >
                {d}
              </button>
            ))}
            <div className="flex items-center justify-center text-slate-300 dark:text-slate-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-emerald-600 active:text-white text-slate-900 dark:text-white text-lg font-bold flex items-center justify-center transition-all active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Backspace"
              className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all active:scale-95"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

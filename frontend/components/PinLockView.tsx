'use client';

import React, { useState } from 'react';
import { Lock, Delete, ShieldCheck } from 'lucide-react';

interface PinLockViewProps {
  correctPin: string;
  onUnlocked: () => void;
}

export default function PinLockView({ correctPin, onUnlocked }: PinLockViewProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        if (nextPin === correctPin) {
          onUnlocked();
        } else {
          setError(true);
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 select-none">
      {/* Top section */}
      <div className="pt-16 text-center space-y-3">
        <div className="w-14 h-14 rounded-3xl bg-emerald-600/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">App Locked</h2>
        <p className="text-xs text-slate-400">Enter your 4-digit security PIN to continue</p>

        {/* PIN dots */}
        <div className="flex items-center justify-center gap-4 pt-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                error
                  ? 'bg-rose-500 scale-110'
                  : pin.length > i
                  ? 'bg-emerald-400 scale-110 shadow-lg shadow-emerald-400/50'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-semibold pt-2 animate-bounce">
            Incorrect PIN, try again
          </p>
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs pb-12">
        <div className="grid grid-cols-3 gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              className="w-16 h-16 mx-auto rounded-full bg-slate-900 active:bg-emerald-600 border border-slate-800 text-xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md"
            >
              {digit}
            </button>
          ))}
          <div className="flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
          </div>
          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 mx-auto rounded-full bg-slate-900 active:bg-emerald-600 border border-slate-800 text-xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 mx-auto rounded-full bg-slate-900 active:bg-slate-800 border border-slate-800 text-lg flex items-center justify-center text-slate-400 active:text-white transition-all active:scale-95"
            title="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}


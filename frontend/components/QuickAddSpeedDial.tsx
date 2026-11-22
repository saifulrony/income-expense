'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Mic, Sparkles, Calculator, X } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';

export type SpeedDialMethod = 'scanner' | 'voice' | 'ai' | 'manual';

interface QuickAddSpeedDialProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: SpeedDialMethod) => void;
}

export default function QuickAddSpeedDial({
  isOpen,
  onClose,
  onSelectMethod,
}: QuickAddSpeedDialProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setAnimating(true));
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setMounted(false), 240);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const handleSelect = (method: SpeedDialMethod) => {
    triggerHaptic('medium');
    setAnimating(false);
    setTimeout(() => {
      onClose();
      onSelectMethod(method);
    }, 120);
  };

  // 4 circular shortcut buttons radiating along a smooth circular arc path centered on the FAB
  // Center is (0, 0) at the bottom center FAB
  const actions = [
    {
      id: 'scanner' as SpeedDialMethod,
      label: t('scanReceipt'),
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="6.5" y="7.5" width="11" height="9" rx="2" fill="currentColor" fillOpacity="0.25" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.5" strokeWidth="1.8" fill="#FFFFFF" fillOpacity="0.85" stroke="currentColor" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-400 hover:from-emerald-500 hover:to-teal-300 text-white shadow-emerald-600/35 ring-2 ring-white/30 dark:ring-white/15',
      // θ = 155°
      x: -95,
      y: -46,
      delayMs: 0,
    },
    {
      id: 'voice' as SpeedDialMethod,
      label: t('voiceEntry'),
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor">
          <rect x="9" y="3" width="6" height="10" rx="3" fill="currentColor" fillOpacity="0.25" strokeWidth="2" />
          <path d="M5 10v1a7 7 0 0 0 14 0v-1" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="8" y1="22" x2="16" y2="22" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M2.5 11c0-1.8.8-3.3 2-4.2" stroke="#C7D2FE" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M21.5 11c0-1.8-.8-3.3-2-4.2" stroke="#C7D2FE" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white shadow-indigo-600/35 ring-2 ring-white/30 dark:ring-white/15',
      // θ = 115°
      x: -40,
      y: -95,
      delayMs: 45,
    },
    {
      id: 'ai' as SpeedDialMethod,
      label: t('geminiAi'),
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
          <defs>
            <linearGradient id="speeddial-gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>
          </defs>
          {/* Authentic 4-point Google Gemini Star */}
          <path
            d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
            fill="url(#speeddial-gemini-grad)"
          />
          {/* Micro sparkle companion */}
          <path
            d="M19 2C19 3.66 17.66 5 16 5C17.66 5 19 6.34 19 8C19 6.34 20.34 5 22 5C20.34 5 19 3.66 19 2Z"
            fill="#FFFFFF"
            opacity="0.95"
          />
          <circle cx="5" cy="19" r="1.5" fill="#FFFFFF" opacity="0.85" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-amber-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-amber-400 text-white shadow-purple-600/40 ring-2 ring-white/40 dark:ring-white/20',
      // θ = 65°
      x: 40,
      y: -95,
      delayMs: 90,
    },
    {
      id: 'manual' as SpeedDialMethod,
      label: t('calculator'),
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor">
          <rect x="4" y="2" width="16" height="20" rx="3.5" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
          <rect x="7" y="5" width="10" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.85" stroke="none" />
          <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="1" fill="#38BDF8" stroke="none" />
          <circle cx="8" cy="15.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="15.5" r="1" fill="#38BDF8" stroke="none" />
          <circle cx="8" cy="19" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="19" r="1" fill="#10B981" stroke="none" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-600 hover:bg-slate-700 text-white shadow-slate-900/35 ring-2 ring-white/20 dark:ring-white/10',
      // θ = 25°
      x: 95,
      y: -46,
      delayMs: 135,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center select-none overflow-hidden">
      {/* Transparent Click-Outside Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 pointer-events-auto"
        aria-hidden="true"
      />

      {/* Anchor Point directly positioned at the bottom FAB location */}
      <div
        className="relative z-10 flex flex-col items-center pointer-events-auto"
        style={{
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 26px), 36px)',
        }}
      >
        {/* Arc Track Guide (subtle circular line) */}
        <div
          className={`absolute -top-14 left-1/2 -translate-x-1/2 w-56 h-28 rounded-t-full border border-dashed border-white/25 dark:border-white/15 pointer-events-none transition-opacity duration-250 ${
            animating ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* 4 Arc Radial Speed Dial Action Buttons: appear one by one along the round path */}
        {actions.map((act) => {
          return (
            <div
              key={act.id}
              style={{
                transform: animating
                  ? `translate3d(${act.x}px, ${act.y}px, 0px) scale(1)`
                  : 'translate3d(0px, 0px, 0px) scale(0.15)',
                opacity: animating ? 1 : 0,
                transition: 'transform 290ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 200ms ease-out',
                transitionDelay: animating ? `${act.delayMs}ms` : '0ms',
              }}
              className="absolute left-1/2 bottom-5 -translate-x-1/2 flex flex-col items-center group cursor-pointer"
            >
              <button
                type="button"
                onClick={() => handleSelect(act.id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl active:scale-90 hover:scale-105 transition-all ${act.bg}`}
                title={act.label}
              >
                {act.icon}
              </button>
              <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-md whitespace-nowrap mt-1.5 pointer-events-none tracking-tight">
                {act.label}
              </span>
            </div>
          );
        })}

        {/* Center Close FAB button */}
        <button
          type="button"
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-800 text-white border-2 border-white/30 dark:border-slate-700 shadow-2xl flex items-center justify-center active:scale-90 hover:scale-105 transition-all"
          title={t('close')}
        >
          <X className="w-5 h-5 stroke-[2.8] transition-transform duration-200" />
        </button>
      </div>
    </div>
  );
}

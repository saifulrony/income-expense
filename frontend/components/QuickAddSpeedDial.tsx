'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Mic, Sparkles, Calculator, X, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

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
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Small tick for CSS animation to trigger
      const raf = requestAnimationFrame(() => setAnimating(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const handleSelect = (method: SpeedDialMethod) => {
    triggerHaptic('medium');
    onClose();
    setTimeout(() => {
      onSelectMethod(method);
    }, 120);
  };

  const speedDialActions: Array<{
    id: SpeedDialMethod;
    title: string;
    description: string;
    badge: string;
    badgeColor: string;
    icon: React.ReactNode;
    gradient: string;
  }> = [
    {
      id: 'scanner',
      title: 'Smart Receipt Scanner',
      description: 'Camera viewfinder, gallery photo or link',
      badge: 'Camera AI',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      gradient: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
      icon: (
        <div className="relative">
          <Camera className="w-5 h-5 stroke-[2.2]" />
          <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1" />
        </div>
      ),
    },
    {
      id: 'voice',
      title: 'Voice Entry',
      description: 'Speak: "Grocery 350 tk" or "Salary 45000"',
      badge: 'Mic Dictation',
      badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      gradient: 'from-indigo-500 to-purple-600 shadow-indigo-500/25',
      icon: <Mic className="w-5 h-5 stroke-[2.2]" />,
    },
    {
      id: 'ai',
      title: 'AI Smart Assistant',
      description: 'Chat to itemize, split costs or edit records',
      badge: 'Gemini AI',
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      gradient: 'from-amber-500 to-orange-500 shadow-amber-500/25',
      icon: <Sparkles className="w-5 h-5 stroke-[2.2]" />,
    },
    {
      id: 'manual',
      title: 'Manual Entry',
      description: 'Classic form with calculator & categories',
      badge: 'Standard',
      badgeColor: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      gradient: 'from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 shadow-slate-900/25',
      icon: <Calculator className="w-5 h-5 stroke-[2.2]" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end items-center select-none">
      {/* Backdrop with smooth blur transition */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity duration-200 ease-out ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Floating Speed-Dial Container */}
      <div
        className={`relative z-10 w-full max-w-sm px-4 pb-6 flex flex-col items-center gap-2.5 transition-all duration-250 ease-out ${
          animating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        {/* Header label hint */}
        <div className="text-center pb-1">
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400 bg-slate-900/80 px-3 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md shadow-lg">
            Quick Add Shortcut
          </span>
        </div>

        {/* 4 Shortcut Action Cards (staggered entrance) */}
        <div className="w-full space-y-2">
          {speedDialActions.map((action, index) => {
            const delayMs = index * 40;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleSelect(action.id)}
                style={{
                  transitionDelay: `${delayMs}ms`,
                }}
                className={`w-full p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xl flex items-center justify-between gap-3 text-left hover:scale-[1.02] active:scale-[0.98] transition-all group cursor-pointer ${
                  animating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Glowing Icon Circle */}
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${action.gradient} text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}
                  >
                    {action.icon}
                  </div>

                  {/* Title and Subtitle */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {action.title}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${action.badgeColor}`}
                      >
                        {action.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {action.description}
                    </p>
                  </div>
                </div>

                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 transition-colors shrink-0">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Central Close Button with 45° rotated X icon */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-2xl active:scale-90 hover:scale-105 transition-all cursor-pointer border border-white/20 dark:border-black/20"
            aria-label="Close shortcuts menu"
            title="Close"
          >
            <X className="w-5 h-5 stroke-[2.8]" />
          </button>
        </div>
      </div>
    </div>
  );
}

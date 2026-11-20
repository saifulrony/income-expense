'use client';

import { useState, useEffect } from 'react';

export type FinancialPersonaId =
  | 'freelancer'
  | 'student'
  | 'family'
  | 'business'
  | 'saver'
  | 'professional';

export interface FinancialPersona {
  id: FinancialPersonaId;
  title: string;
  subtitle: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const FINANCIAL_PERSONAS: FinancialPersona[] = [
  {
    id: 'freelancer',
    title: 'Freelancer',
    subtitle: 'Multiple clients, invoices & project cash flow',
    icon: '💼',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-500/30',
  },
  {
    id: 'student',
    title: 'Student / Minimalist',
    subtitle: 'Pocket allowance, mess fees & light tracking',
    icon: '🎓',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
  },
  {
    id: 'family',
    title: 'Family Organizer',
    subtitle: 'Groceries, home rent, bills & shared ledger',
    icon: '👨‍👩‍👧',
    badgeBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-500/30',
  },
  {
    id: 'business',
    title: 'Small Business Owner',
    subtitle: 'Shop cash-in/out, vendor dues & daily balances',
    icon: '🏢',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/30',
  },
  {
    id: 'saver',
    title: 'Savvy Saver',
    subtitle: 'Budget optimization & 30%+ savings discipline',
    icon: '🎯',
    badgeBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    badgeText: 'text-teal-700 dark:text-teal-300',
    badgeBorder: 'border-teal-500/30',
  },
  {
    id: 'professional',
    title: 'Working Professional',
    subtitle: 'Monthly salary, EMIs, investments & tax audit',
    icon: '👔',
    badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
  },
];

const STORAGE_KEY = 'cashflow_user_persona_v1';
export const PERSONA_CHANGE_EVENT = 'cashflow_persona_changed';

export function getStoredPersona(): FinancialPersona {
  if (typeof window === 'undefined') return FINANCIAL_PERSONAS[0];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const found = FINANCIAL_PERSONAS.find((p) => p.id === saved);
    if (found) return found;
  } catch {}
  return FINANCIAL_PERSONAS[0]; // Default: Freelancer
}

export function setStoredPersona(id: FinancialPersonaId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
    const persona = FINANCIAL_PERSONAS.find((p) => p.id === id) || FINANCIAL_PERSONAS[0];
    window.dispatchEvent(new CustomEvent(PERSONA_CHANGE_EVENT, { detail: persona }));
  } catch {}
}

export function useUserPersona(): [FinancialPersona, (id: FinancialPersonaId) => void] {
  const [persona, setPersonaState] = useState<FinancialPersona>(() => getStoredPersona());

  useEffect(() => {
    setPersonaState(getStoredPersona());

    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as FinancialPersona | undefined;
      setPersonaState(detail || getStoredPersona());
    };

    window.addEventListener(PERSONA_CHANGE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(PERSONA_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updatePersona = (id: FinancialPersonaId) => {
    setStoredPersona(id);
    const found = FINANCIAL_PERSONAS.find((p) => p.id === id) || FINANCIAL_PERSONAS[0];
    setPersonaState(found);
  };

  return [persona, updatePersona];
}

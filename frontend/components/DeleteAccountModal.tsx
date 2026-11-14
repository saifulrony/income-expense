'use client';

import React, { useState } from 'react';
import { api, removeAuthToken } from '@/lib/api';
import { ShieldAlert, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
  userEmail: string;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onAccountDeleted,
  userEmail,
}: DeleteAccountModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      setError('Please type DELETE to confirm account removal.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.deleteAccount();
      await removeAuthToken();
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
      onAccountDeleted();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-rose-950/50 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400">
              Delete Account & Data
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl text-[11px] text-rose-800 dark:text-rose-300 space-y-1.5">
          <div className="font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Permanent & Irreversible Action</span>
          </div>
          <p>
            Deleting account <strong className="font-mono">{userEmail}</strong> will permanently wipe:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1 text-rose-700 dark:text-rose-300/80">
            <li>All Cash In and Cash Out transactions</li>
            <li>Custom categories and spending limits</li>
            <li>Recurring transaction schedules</li>
            <li>Cloud sync metadata and local preferences</li>
          </ul>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
            Type <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">DELETE</span> below to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Type DELETE"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-rose-500 font-mono text-center tracking-wider"
          />
        </div>

        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || confirmInput.trim().toUpperCase() !== 'DELETE'}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


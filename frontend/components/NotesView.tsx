'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatDate, formatTime } from '@/lib/time-settings';
import { useTranslation } from '@/lib/i18n';
import {
  FileText,
  Plus,
  Check,
  Trash2,
  Pencil,
  X,
  Search,
  ChevronLeft,
  CheckCircle2,
  Circle,
} from 'lucide-react';

export interface NoteItem {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface NotesViewProps {
  onBack?: () => void;
}

export const STORAGE_KEY_NOTES = 'cashflow_user_notes';

export default function NotesView({ onBack }: NotesViewProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newText, setNewText] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_NOTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setNotes(parsed);
      }
    } catch {}
  }, []);

  const saveNotes = (next: NoteItem[]) => {
    setNotes(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(next));
      } catch {}
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const item: NoteItem = {
      id: 'note-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      completed: false,
      created_at: now,
      updated_at: now,
    };
    saveNotes([item, ...notes]);
    setNewText('');
  };

  const handleToggleNote = (id: string) => {
    const now = new Date().toISOString();
    saveNotes(
      notes.map((n) =>
        n.id === id ? { ...n, completed: !n.completed, updated_at: now } : n
      )
    );
  };

  const handleStartEdit = (note: NoteItem) => {
    setEditingId(note.id);
    setEditDraft(note.text);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const now = new Date().toISOString();
    saveNotes(
      notes.map((n) =>
        n.id === id ? { ...n, text: trimmed, updated_at: now } : n
      )
    );
    setEditingId(null);
    setEditDraft('');
  };

  const handleDeleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDraft('');
    }
  };

  const handleClearCompleted = () => {
    saveNotes(notes.filter((n) => !n.completed));
  };

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    for (const n of notes) {
      if (n.completed) completed++;
      else active++;
    }
    return { total: notes.length, active, completed };
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter === 'active' && n.completed) return false;
      if (filter === 'completed' && !n.completed) return false;
      if (q && !n.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, filter, search]);

  return (
    <div className="space-y-3.5 pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-all shrink-0"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{t('notesChecklist')}</span>
            <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {counts.active}
            </span>
          </h2>
        </div>

        {counts.completed > 0 && (
          <button
            type="button"
            onClick={handleClearCompleted}
            className="px-2.5 py-1.5 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('done')} ({counts.completed})</span>
          </button>
        )}
      </div>

      {/* Add Note Input Form */}
      <form
        onSubmit={handleAddNote}
        className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-3 shadow-xs flex items-center gap-2"
      >
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={t('writeNotePlaceholder')}
          className="flex-1 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!newText.trim()}
          className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1 shadow-xs active:scale-98 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{t('add')}</span>
        </button>
      </form>

      {/* Filter Tabs & Search */}
      {notes.length > 0 && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/70 p-0.5 rounded-md">
            {(
              [
                { id: 'all', label: `${t('allShort')} (${counts.total})` },
                { id: 'active', label: `${t('active')} (${counts.active})` },
                { id: 'completed', label: `${t('done')} (${counts.completed})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-all ${
                  filter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-8 pr-7 py-1 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-8 text-center space-y-2 shadow-xs">
          <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {notes.length === 0 ? 'No notes yet' : 'No matching notes'}
          </div>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            {notes.length === 0
              ? 'Add quick notes, shopping lists, or payment reminders above and tick them off when done.'
              : 'Try switching the filter tab or clearing your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotes.map((note) => {
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                className={`bg-white dark:bg-slate-800/90 rounded-[10px] border p-3 shadow-xs flex items-start justify-between gap-2.5 transition-all ${
                  note.completed
                    ? 'border-slate-200/60 dark:border-slate-800 opacity-75'
                    : 'border-slate-200/90 dark:border-slate-700/80'
                }`}
              >
                {/* Tick Checkbox + Content */}
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleNote(note.id)}
                    className={`mt-0.5 shrink-0 transition-colors ${
                      note.completed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-300 dark:text-slate-600 hover:text-emerald-500'
                    }`}
                    aria-label={note.completed ? 'Mark as incomplete' : 'Mark as completed'}
                  >
                    {note.completed ? (
                      <CheckCircle2 className="w-4.5 h-4.5 stroke-[2.4]" />
                    ) : (
                      <Circle className="w-4.5 h-4.5 stroke-[2.2]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(note.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditDraft('');
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-900 border border-emerald-500 text-xs text-slate-900 dark:text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(note.id)}
                          className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 shrink-0"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft('');
                          }}
                          className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p
                          onClick={() => handleToggleNote(note.id)}
                          className={`text-xs font-semibold break-words cursor-pointer select-none ${
                            note.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {note.text}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {formatDate(note.updated_at)} • {formatTime(note.updated_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit & Delete Buttons */}
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(note)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                      title="Edit note"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


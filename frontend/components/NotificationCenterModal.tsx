'use client';

import React from 'react';
import {
  Bell,
  BellRing,
  X,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Zap,
  Trophy,
  BarChart3,
  Settings,
} from 'lucide-react';
import {
  AppNotification,
  markAllNotificationsAsRead,
  clearAllNotifications,
  markNotificationAsRead,
} from '@/lib/notifications';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onOpenSettings?: () => void;
  onOpenCategories?: () => void;
  onOpenReminders?: () => void;
}

export default function NotificationCenterModal({
  isOpen,
  onClose,
  notifications,
  onOpenSettings,
  onOpenCategories,
  onOpenReminders,
}: NotificationCenterModalProps) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'over_budget':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'budget_warning':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'month_end_success':
        return <Trophy className="w-4 h-4 text-emerald-500" />;
      case 'month_end_summary':
        return <BarChart3 className="w-4 h-4 text-indigo-500" />;
      case 'reminder':
        return <BellRing className="w-4 h-4 text-amber-500" />;
      case 'test':
      default:
        return <Bell className="w-4 h-4 text-emerald-500" />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-5">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Popover Card */}
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in slide-in-from-top-4 duration-150 mt-14 sm:mt-12">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Alerts &amp; Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-rose-500 text-white">
                    {unreadCount} new
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => markAllNotificationsAsRead()}
                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => clearAllNotifications()}
                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1 flex-1">
          {notifications.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
                <Bell className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No notifications yet
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] mx-auto">
                Important budget exceeded warnings and month-end performance updates will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) markNotificationAsRead(item.id);
                  if (item.type === 'over_budget' || item.type === 'budget_warning') {
                    if (onOpenCategories) {
                      onOpenCategories();
                      onClose();
                    }
                  } else if (item.type === 'reminder') {
                    if (onOpenReminders) {
                      onOpenReminders();
                      onClose();
                    }
                  }
                }}
                className={`p-3 rounded-lg transition-colors cursor-pointer text-left ${
                  !item.read
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-white dark:bg-slate-800 shadow-2xs border border-slate-200/60 dark:border-slate-700/60 shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          !item.read
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.title}
                      </h4>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {item.body}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      {formatTime(item.date)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Settings & Reminders Quick-Links */}
        <div className="p-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between text-xs">
          {onOpenReminders ? (
            <button
              type="button"
              onClick={() => {
                onOpenReminders();
                onClose();
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Bill Reminders</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Manage alerts anytime</span>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Alert Settings</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

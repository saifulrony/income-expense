/**
 * CashFlow Important Financial Notification Engine
 * - Budget exceeded alerts
 * - Approaching limit warnings (85-90%)
 * - Month-end performance summary & celebrations
 * - Persistent in-app alert history
 * - Android Native (Capacitor LocalNotifications) + Web Notification API integration
 * - Complete stop/pause controls in Settings
 */

import { BudgetOverview, Transaction } from './types';
import { formatAmount } from './currency';

export interface NotificationPreferences {
  enabled: boolean;             // Master kill-switch: Stop all notifications
  overBudgetAlerts: boolean;    // When category/total spend crosses 100% of budget
  budgetWarningAlerts: boolean; // When category spend reaches 85%+ of budget
  monthEndReport: boolean;      // Month-end performance review & savings celebration
}

export interface AppNotification {
  id: string;
  type: 'over_budget' | 'budget_warning' | 'month_end_success' | 'month_end_summary' | 'reminder' | 'test';
  title: string;
  body: string;
  date: string; // ISO
  read: boolean;
  category_id?: string;
  reminder_id?: string;
}

export const LOCKSCREEN_CHANNEL_ID = 'cashflow_alerts_lockscreen';

const PREFS_STORAGE_KEY = 'cashflow_notification_preferences';
const NOTIFICATIONS_STORAGE_KEY = 'cashflow_inapp_notifications';
const SENT_KEYS_STORAGE_KEY = 'cashflow_sent_notification_keys';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  overBudgetAlerts: true,
  budgetWarningAlerts: true,
  monthEndReport: true,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Read current notification preferences
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save notification preferences
 */
export function setNotificationPreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('cashflow-notification-prefs-changed', { detail: prefs }));
  } catch (err) {
    console.error('Failed to save notification preferences', err);
  }
}

/**
 * Read in-app notification history (filters out premature reminders due in the future)
 */
export function getStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const list: AppNotification[] = JSON.parse(raw);
    const todayStr = new Date().toISOString().slice(0, 10);

    return list.filter((n) => {
      if (n.type === 'reminder' && n.body && n.body.includes('Due: ')) {
        const match = n.body.match(/Due:\s*(\d{4}-\d{2}-\d{2})/);
        if (match && match[1] > todayStr) {
          return false; // Do not show future due alerts in today's notification list!
        }
      }
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * Mark a single notification as read
 */
export function markNotificationAsRead(id: string): void {
  if (typeof window === 'undefined') return;
  const list = getStoredNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('cashflow-notifications-updated'));
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead(): void {
  if (typeof window === 'undefined') return;
  const list = getStoredNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('cashflow-notifications-updated'));
}

/**
 * Clear all notifications
 */
export function clearAllNotifications(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
  window.dispatchEvent(new Event('cashflow-notifications-updated'));
}

/**
 * Request OS/Browser Notification Permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Android Native via Capacitor
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    }
  } catch (err) {
    console.warn('Capacitor LocalNotifications request failed', err);
  }

  // 2. Standard Web Notification API
  if ('Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Check if OS/Browser permission is currently granted
 */
export async function checkNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (typeof window === 'undefined') return 'default';

  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      return perm.display === 'granted' ? 'granted' : perm.display === 'denied' ? 'denied' : 'default';
    }
  } catch {
    // fallback to web
  }

  if ('Notification' in window) {
    return Notification.permission as 'granted' | 'denied' | 'default';
  }

  return 'default';
}

/**
 * Check if a dedup key was already triggered (e.g. over_budget_catId_2026-11)
 */
function hasAlreadySent(dedupKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SENT_KEYS_STORAGE_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    return set.includes(dedupKey);
  } catch {
    return false;
  }
}

/**
 * Record a dedup key so user is not spammed repeatedly
 */
function recordSent(dedupKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SENT_KEYS_STORAGE_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (!set.includes(dedupKey)) {
      set.push(dedupKey);
      // Keep at most 200 recent dedup keys
      if (set.length > 200) set.splice(0, set.length - 200);
      localStorage.setItem(SENT_KEYS_STORAGE_KEY, JSON.stringify(set));
    }
  } catch (err) {
    console.warn('Failed to record sent notification key', err);
  }
}

/**
 * Ensures the High-Importance Android Notification Channel exists with PUBLIC lock-screen visibility
 * (importance: 5 = IMPORTANCE_HIGH, visibility: 1 = VISIBILITY_PUBLIC)
 */
export async function ensureLockScreenNotificationChannel(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.createChannel({
        id: LOCKSCREEN_CHANNEL_ID,
        name: 'CashFlow Alerts & Bill Reminders',
        description: 'Important bill reminders and budget alerts shown on the lock screen',
        importance: 5, // IMPORTANCE_HIGH (heads-up + lock screen wake)
        visibility: 1, // VISIBILITY_PUBLIC (show full content on lock screen)
        vibration: true,
        lights: true,
        lightColor: '#10B981',
      });
    }
  } catch (err) {
    console.warn('Failed to create lock-screen notification channel', err);
  }
}

/**
 * Push a notification directly into the in-app Notification Bell icon history
 */
export function recordInAppNotification(
  notification: Omit<AppNotification, 'id' | 'date' | 'read'>,
  dedupKey?: string
): AppNotification | null {
  if (typeof window === 'undefined') return null;
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return null;

  if (dedupKey) {
    if (hasAlreadySent(dedupKey)) return null;
    recordSent(dedupKey);
  }

  const appNotif: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString(),
    read: false,
    ...notification,
  };

  try {
    const current = getStoredNotifications();
    const updated = [appNotif, ...current].slice(0, 50);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('cashflow-notifications-updated', { detail: appNotif }));
  } catch (err) {
    console.error('Error saving in-app notification', err);
  }

  return appNotif;
}

/**
 * Play a short, pleasant notification chime & vibrate device for heads-up push alerts
 */
function playPushAlertFeedback(): void {
  if (typeof window === 'undefined') return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([220, 100, 220]);
    }
  } catch {}
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {}
}

/**
 * Fire an OS / Phone Lock-Screen Push Notification (Android Native + Web ServiceWorker Push + Heads-Up Banner)
 */
export async function fireLockScreenOSNotification(options: {
  id?: number;
  title: string;
  body: string;
  tag?: string;
  scheduleAt?: Date;
  repeats?: boolean;
  every?: 'hour' | 'day' | 'week' | 'month';
  extra?: Record<string, any>;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return;

  const notifId = options.id || Math.floor(Math.random() * 899999) + 100000;
  const delay = options.scheduleAt ? options.scheduleAt.getTime() - Date.now() : 0;

  // Dispatch In-App Heads-Up Push Banner (works even on HTTP LAN IP where Chrome blocks Web Push)
  const triggerHeadsUpBanner = () => {
    playPushAlertFeedback();
    window.dispatchEvent(
      new CustomEvent('cashflow-push-banner', {
        detail: {
          id: notifId,
          title: options.title,
          body: options.body,
          extra: options.extra || {},
        },
      })
    );
  };

  if (delay <= 500) {
    triggerHeadsUpBanner();
  } else if (delay < 86400000) {
    setTimeout(() => {
      triggerHeadsUpBanner();
    }, delay);
  }

  // 1. Android Native via Capacitor (with lock-screen PUBLIC channel + allowWhileIdle)
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      await ensureLockScreenNotificationChannel();

      const atDate =
        options.scheduleAt && options.scheduleAt.getTime() > Date.now()
          ? options.scheduleAt
          : new Date(Date.now() + 250);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: options.title,
            body: options.body,
            channelId: LOCKSCREEN_CHANNEL_ID,
            schedule: {
              at: atDate,
              repeats: Boolean(options.repeats && options.every),
              every: options.every,
              allowWhileIdle: true, // wakes device on lock screen even during Doze mode
            },
            extra: options.extra || {},
          },
        ],
      });
      return;
    }
  } catch (err) {
    console.warn('Could not dispatch Capacitor LocalNotification', err);
  }

  // 2. Web / Mobile PWA ServiceWorker Push & Notification API
  if ('Notification' in window) {
    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        const triggerWebNotif = async () => {
          const notifOptions: any = {
            body: options.body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: options.tag || `cashflow_${notifId}`,
            requireInteraction: true,
            renotify: true,
            silent: false,
            vibrate: [250, 120, 250],
            data: options.extra || {},
          };

          if ('serviceWorker' in navigator) {
            try {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_PUSH_NOTIFICATION',
                  title: options.title,
                  body: options.body,
                  tag: options.tag || `cashflow_${notifId}`,
                  extra: options.extra || {},
                });
                return;
              }
              const reg = await navigator.serviceWorker.getRegistration();
              if (reg && typeof reg.showNotification === 'function') {
                await reg.showNotification(options.title, notifOptions);
                return;
              }
            } catch {
              // fallback to window.Notification
            }
          }

          new Notification(options.title, notifOptions);
        };

        if (delay <= 500) {
          await triggerWebNotif();
        } else if (delay < 86400000) {
          setTimeout(() => {
            triggerWebNotif();
          }, delay);
        }
      }
    } catch (err) {
      console.warn('Could not dispatch Web Notification', err);
    }
  }
}

/**
 * Internal notification dispatcher (Native + Web + In-App Store)
 */
async function dispatchNotification(
  notification: Omit<AppNotification, 'id' | 'date' | 'read'>,
  dedupKey?: string
): Promise<void> {
  const appNotif = recordInAppNotification(notification, dedupKey);
  if (!appNotif) return;

  await fireLockScreenOSNotification({
    title: notification.title,
    body: notification.body,
    tag: dedupKey || appNotif.id,
    extra: {
      type: notification.type,
      category_id: notification.category_id,
      reminder_id: notification.reminder_id,
    },
  });
}

/**
 * Evaluates active budget status and dispatches Over-Budget / Warning notifications
 */
export function checkBudgetNotifications(
  budgetOverview?: BudgetOverview | null,
  currencySymbol: string = '৳'
): void {
  if (!budgetOverview) return;
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return;

  const currentMonth = budgetOverview.month || new Date().toISOString().slice(0, 7);

  // 1. Check each category budget
  if (budgetOverview.budgets && budgetOverview.budgets.length > 0) {
    for (const b of budgetOverview.budgets) {
      if (!b.budget_limit || b.budget_limit <= 0) continue;

      // Exceeded threshold (100%+)
      if (b.status === 'exceeded' || b.actual_spent > b.budget_limit) {
        if (prefs.overBudgetAlerts) {
          const key = `over_budget_${b.category_id}_${currentMonth}`;
          dispatchNotification(
            {
              type: 'over_budget',
              title: `⚠️ Budget Exceeded: ${b.category_name}`,
              body: `You spent ${currencySymbol}${formatAmount(b.actual_spent)} of your ${currencySymbol}${formatAmount(b.budget_limit)} budget (${Math.round(b.percentage)}%). Limit exceeded!`,
              category_id: b.category_id,
            },
            key
          );
        }
      }
      // Warning threshold (85% - 99%)
      else if (b.percentage >= 85 && b.percentage < 100) {
        if (prefs.budgetWarningAlerts) {
          const key = `budget_warning_${b.category_id}_${currentMonth}`;
          dispatchNotification(
            {
              type: 'budget_warning',
              title: `⚡ Budget Warning: ${b.category_name}`,
              body: `You've reached ${Math.round(b.percentage)}% of your limit (${currencySymbol}${formatAmount(b.remaining)} remaining). Keep spending mindful!`,
              category_id: b.category_id,
            },
            key
          );
        }
      }
    }
  }

  // 2. Check total monthly budget
  if (
    prefs.overBudgetAlerts &&
    budgetOverview.total_budget > 0 &&
    budgetOverview.total_spent > budgetOverview.total_budget
  ) {
    const key = `over_budget_total_${currentMonth}`;
    dispatchNotification(
      {
        type: 'over_budget',
        title: '⚠️ Total Monthly Budget Exceeded',
        body: `Total monthly spend is ${currencySymbol}${formatAmount(budgetOverview.total_spent)}, exceeding your ${currencySymbol}${formatAmount(budgetOverview.total_budget)} overall budget.`,
      },
      key
    );
  }
}

/**
 * Checks month-end performance and dispatches congratulatory savings report or summary
 */
export function checkMonthEndPerformance(
  transactions: Transaction[],
  currencySymbol: string = '৳'
): void {
  const prefs = getNotificationPreferences();
  if (!prefs.enabled || !prefs.monthEndReport) return;
  if (!transactions || transactions.length === 0) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0..11

  // Compute previous month (e.g. if today is Nov 2026, prev is Oct 2026)
  const prevDate = new Date(currentYear, currentMonthIdx - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonthIdx = prevDate.getMonth();
  const prevMonthKey = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}`;
  const prevMonthName = MONTH_NAMES[prevMonthIdx];

  // Month before previous month for comparative analysis
  const priorDate = new Date(prevYear, prevMonthIdx - 1, 1);
  const priorYear = priorDate.getFullYear();
  const priorMonthIdx = priorDate.getMonth();
  const priorMonthKey = `${priorYear}-${String(priorMonthIdx + 1).padStart(2, '0')}`;
  const priorMonthName = MONTH_NAMES[priorMonthIdx];

  const dedupKey = `month_end_report_${prevMonthKey}`;
  if (hasAlreadySent(dedupKey)) return;

  // Filter transactions for previous month
  const prevTxs = transactions.filter((t) => t?.date && t.date.startsWith(prevMonthKey));
  if (prevTxs.length === 0) return; // No activity to report

  let prevIncome = 0;
  let prevExpense = 0;
  for (const t of prevTxs) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') prevIncome += amt;
    else prevExpense += amt;
  }

  const prevNet = prevIncome - prevExpense;

  // Filter transactions for prior month to compare
  const priorTxs = transactions.filter((t) => t?.date && t.date.startsWith(priorMonthKey));
  let priorExpense = 0;
  for (const t of priorTxs) {
    if (t.type === 'expense') priorExpense += Number(t.amount) || 0;
  }

  // Case 1: Saved more / spent less than prior month
  if (priorTxs.length > 0 && prevExpense < priorExpense) {
    const diff = priorExpense - prevExpense;
    const pct = Math.round((diff / priorExpense) * 100);
    dispatchNotification(
      {
        type: 'month_end_success',
        title: `🎉 Great Job! ${prevMonthName} Savings Champion`,
        body: `In ${prevMonthName}, you spent ${currencySymbol}${formatAmount(prevExpense)}, saving ${currencySymbol}${formatAmount(diff)} (${pct}% less than ${priorMonthName})! Excellent discipline!`,
      },
      dedupKey
    );
    return;
  }

  // Case 2: Positive net savings
  if (prevNet > 0 && prevIncome > 0) {
    const rate = Math.round((prevNet / prevIncome) * 100);
    dispatchNotification(
      {
        type: 'month_end_success',
        title: `🏆 ${prevMonthName} Financial Wrap-up`,
        body: `You finished ${prevMonthName} with ${currencySymbol}${formatAmount(prevNet)} in net savings (${rate}% savings rate). Keep up the great momentum!`,
      },
      dedupKey
    );
    return;
  }

  // Case 3: General summary report
  dispatchNotification(
    {
      type: 'month_end_summary',
      title: `📊 ${prevMonthName} Monthly Performance`,
      body: `Total spent in ${prevMonthName}: ${currencySymbol}${formatAmount(prevExpense)}. A new month has started — a great opportunity to set new savings goals!`,
    },
    dedupKey
  );
}

/**
 * Triggers a test notification so the user can verify their notification setup
 */
export async function sendTestNotification(currencySymbol: string = '৳'): Promise<void> {
  await dispatchNotification({
    type: 'test',
    title: '🔔 CashFlow Alerts Active',
    body: `Budget overspending warnings and month-end performance updates will appear here! (Current symbol: ${currencySymbol})`,
  });
}

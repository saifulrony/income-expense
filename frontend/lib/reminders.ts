/**
 * CashFlow Task & Bill Reminders Engine
 * - Custom bill and task reminders (e.g., "Pay electric bill on 30th Nov")
 * - Scheduled notifications via Android Capacitor LocalNotifications & Web Notifications
 * - 1-tap "Log as Expense" conversion into ledger
 * - Offline-first persistent storage
 */

import { formatAmount } from './currency';
import {
  recordInAppNotification,
  fireLockScreenOSNotification,
  requestNotificationPermission,
} from './notifications';

export type ReminderRecurrence = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface TaskReminder {
  id: string;
  title: string;                 // e.g. "Pay electric bill"
  amount?: number;               // e.g. 1500
  due_date: string;              // YYYY-MM-DD
  due_time?: string;             // HH:mm (default "09:00")
  recurrence?: ReminderRecurrence; // 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  note?: string;                 // e.g. "dont forget!"
  category_id?: string;          // optional category link
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  notification_id: number;       // integer ID for local-notifications
}

export function getRecurrenceLabel(recurrence?: ReminderRecurrence): string {
  switch (recurrence) {
    case 'hourly':
      return 'Per Hour';
    case 'daily':
      return 'Per Day';
    case 'weekly':
      return 'Per Week';
    case 'monthly':
      return 'Per Month';
    case 'none':
    default:
      return 'One-time';
  }
}

export function computeNextOccurrence(
  dueDate: string,
  dueTime: string = '09:00',
  recurrence?: ReminderRecurrence
): { due_date: string; due_time: string } {
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = (dueTime || '09:00').split(':').map(Number);
  const dt = new Date(year, (month || 1) - 1, day || 1, hour || 9, minute || 0, 0, 0);

  if (recurrence === 'hourly') {
    dt.setHours(dt.getHours() + 1);
  } else if (recurrence === 'daily') {
    dt.setDate(dt.getDate() + 1);
  } else if (recurrence === 'weekly') {
    dt.setDate(dt.getDate() + 7);
  } else if (recurrence === 'monthly') {
    dt.setMonth(dt.getMonth() + 1);
  }

  const nextDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const nextTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return { due_date: nextDate, due_time: nextTime };
}

const STORAGE_KEY = 'cashflow_task_reminders';
const REMINDERS_EVENT = 'cashflow-reminders-updated';

/**
 * Get all stored reminders
 */
export function getStoredReminders(): TaskReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: TaskReminder[] = [
        {
          id: 'rem_electric_bill',
          title: 'Pay Electric Bill',
          amount: 1250,
          due_date: '2026-11-30',
          due_time: '10:00',
          note: "Don't forget!",
          is_completed: false,
          created_at: new Date().toISOString(),
          notification_id: 100001,
        },
      ];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      } catch {}
      return initial;
    }
    const list: TaskReminder[] = JSON.parse(raw);
    return list.sort((a, b) => {
      // Uncompleted first, then by due date
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }
      return (a.due_date + (a.due_time || '')) > (b.due_date + (b.due_time || '')) ? 1 : -1;
    });
  } catch (err) {
    console.error('Error reading reminders', err);
    return [];
  }
}

/**
 * Save reminders list
 */
function saveStoredReminders(list: TaskReminder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(REMINDERS_EVENT, { detail: list }));
  } catch (err) {
    console.error('Error saving reminders', err);
  }
}

/**
 * Build human-readable notification title & body for a reminder
 */
function buildReminderNotificationPayload(
  reminder: TaskReminder,
  currencySymbol: string = '৳',
  mode: 'due' | 'scheduled' = 'due'
): { title: string; body: string } {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = !reminder.is_completed && reminder.due_date < todayStr;
  const isToday = reminder.due_date === todayStr;

  const title =
    mode === 'scheduled' && !isToday && !isOverdue
      ? `🔔 Reminder: ${reminder.title}`
      : isOverdue
      ? `⚠️ Overdue Bill: ${reminder.title}`
      : `⏰ Reminder: ${reminder.title}`;

  const amountStr =
    reminder.amount && reminder.amount > 0 ? `${currencySymbol}${formatAmount(reminder.amount)} • ` : '';
  const dueStr = `${reminder.due_date}${reminder.due_time ? ` at ${reminder.due_time}` : ''}`;
  const recStr =
    reminder.recurrence && reminder.recurrence !== 'none'
      ? ` • Repeats ${getRecurrenceLabel(reminder.recurrence)}`
      : '';
  const noteStr = reminder.note ? `${reminder.note} — ` : '';
  const body = `${amountStr}${noteStr}Due: ${dueStr}${recStr}`;

  return { title, body };
}

/**
 * Trigger a reminder alert immediately in BOTH the in-app Notification Bell icon AND the Phone Lock Screen
 */
export async function triggerReminderNotificationNow(
  reminder: TaskReminder,
  currencySymbol: string = '৳',
  dedupKey?: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  await requestNotificationPermission();

  const { title, body } = buildReminderNotificationPayload(reminder, currencySymbol, 'due');

  // 1. Add to In-App Notification Bell Icon (Header Bell & NotificationCenterModal)
  const appNotif = recordInAppNotification(
    {
      type: 'reminder',
      title,
      body,
      reminder_id: reminder.id,
      category_id: reminder.category_id,
    },
    dedupKey
  );

  // If deduplicated (already sent for this key), skip re-firing OS lock-screen alert
  if (dedupKey && !appNotif) return;

  // 2. Fire OS / Phone Lock-Screen Notification
  await fireLockScreenOSNotification({
    id: reminder.notification_id,
    title,
    body,
    tag: dedupKey || `reminder_${reminder.id}_${Date.now()}`,
    extra: {
      type: 'reminder',
      reminderId: reminder.id,
    },
  });
}

/**
 * Schedule native/web lock-screen notification for a reminder & record in Notification Bell icon
 */
async function scheduleReminderNotification(reminder: TaskReminder, currencySymbol: string = '৳'): Promise<void> {
  if (typeof window === 'undefined' || reminder.is_completed) return;

  await requestNotificationPermission();

  const [year, month, day] = reminder.due_date.split('-').map(Number);
  const [hour, minute] = (reminder.due_time || '09:00').split(':').map(Number);
  const scheduleTime = new Date(year, month - 1, day, hour || 9, minute || 0, 0, 0);

  const { title, body } = buildReminderNotificationPayload(reminder, currencySymbol, 'scheduled');

  // 1. Always record in the In-App Notification Bell Icon so user sees it in the header Bell
  recordInAppNotification(
    {
      type: 'reminder',
      title,
      body,
      reminder_id: reminder.id,
      category_id: reminder.category_id,
    },
    `reminder_bell_${reminder.id}_${reminder.due_date}_${reminder.due_time || '09:00'}_${reminder.amount || 0}`
  );

  // Map recurrence to Capacitor 'every' unit
  const everyUnit: 'hour' | 'day' | 'week' | 'month' | undefined =
    reminder.recurrence === 'hourly'
      ? 'hour'
      : reminder.recurrence === 'daily'
      ? 'day'
      : reminder.recurrence === 'weekly'
      ? 'week'
      : reminder.recurrence === 'monthly'
      ? 'month'
      : undefined;

  // 2. Schedule OS / Lock-Screen notification for the due date & time
  if (scheduleTime.getTime() > Date.now()) {
    await fireLockScreenOSNotification({
      id: reminder.notification_id,
      title: `⏰ Reminder: ${reminder.title}`,
      body,
      tag: `reminder_due_${reminder.id}`,
      scheduleAt: scheduleTime,
      repeats: Boolean(everyUnit),
      every: everyUnit,
      extra: {
        type: 'reminder',
        reminderId: reminder.id,
        recurrence: reminder.recurrence || 'none',
      },
    });

    // Also fire an immediate lock-screen confirmation notification when scheduled/updated
    await fireLockScreenOSNotification({
      id: reminder.notification_id + 1,
      title,
      body,
      tag: `reminder_set_${reminder.id}`,
      extra: {
        type: 'reminder',
        reminderId: reminder.id,
      },
    });

    // If due within the next 24h while app is open, also push an unread due alert into the Bell icon at due time
    const delay = scheduleTime.getTime() - Date.now();
    if (delay > 0 && delay < 86400000) {
      setTimeout(() => {
        recordInAppNotification(
          {
            type: 'reminder',
            title: `⏰ Due Now: ${reminder.title}`,
            body,
            reminder_id: reminder.id,
            category_id: reminder.category_id,
          },
          `reminder_duenow_${reminder.id}_${reminder.due_date}_${reminder.due_time}`
        );
      }, delay);
    }
  } else {
    // Already due or overdue today -> fire lock-screen notification right away (with repeat if recurring)
    await fireLockScreenOSNotification({
      id: reminder.notification_id,
      title: `⏰ Due Today: ${reminder.title}`,
      body,
      tag: `reminder_due_${reminder.id}`,
      repeats: Boolean(everyUnit),
      every: everyUnit,
      extra: {
        type: 'reminder',
        reminderId: reminder.id,
        recurrence: reminder.recurrence || 'none',
      },
    });
  }
}

/**
 * Cancel a scheduled native notification
 */
async function cancelReminderNotification(notificationId: number): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({
        notifications: [{ id: notificationId }, { id: notificationId + 1 }],
      });
    }
  } catch (err) {
    console.warn('Could not cancel Capacitor reminder notification', err);
  }
}

/**
 * Create a new reminder
 */
export async function createReminder(
  data: {
    title: string;
    amount?: number;
    due_date: string;
    due_time?: string;
    recurrence?: ReminderRecurrence;
    note?: string;
    category_id?: string;
  },
  currencySymbol: string = '৳'
): Promise<TaskReminder> {
  const notifId = Math.floor(Math.random() * 899999) + 100000;
  const newReminder: TaskReminder = {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: data.title.trim(),
    amount: data.amount && data.amount > 0 ? Number(data.amount) : undefined,
    due_date: data.due_date,
    due_time: data.due_time || '09:00',
    recurrence: data.recurrence || 'none',
    note: data.note ? data.note.trim() : undefined,
    category_id: data.category_id,
    is_completed: false,
    created_at: new Date().toISOString(),
    notification_id: notifId,
  };

  const current = getStoredReminders();
  saveStoredReminders([newReminder, ...current]);

  await scheduleReminderNotification(newReminder, currencySymbol);

  return newReminder;
}

/**
 * Advance a recurring reminder to its next occurrence (hourly, daily, weekly, monthly)
 */
export async function advanceRecurringReminder(
  id: string,
  currencySymbol: string = '৳'
): Promise<TaskReminder | null> {
  const list = getStoredReminders();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  if (!current.recurrence || current.recurrence === 'none') return null;

  const next = computeNextOccurrence(current.due_date, current.due_time || '09:00', current.recurrence);
  const updated: TaskReminder = {
    ...current,
    due_date: next.due_date,
    due_time: next.due_time,
    is_completed: false,
    completed_at: undefined,
  };
  list[idx] = updated;
  saveStoredReminders(list);

  await cancelReminderNotification(updated.notification_id);
  await scheduleReminderNotification(updated, currencySymbol);

  return updated;
}

/**
 * Update an existing reminder
 */
export async function updateReminder(
  id: string,
  data: Partial<TaskReminder>,
  currencySymbol: string = '৳'
): Promise<TaskReminder | null> {
  const list = getStoredReminders();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const updated: TaskReminder = { ...list[idx], ...data };
  list[idx] = updated;
  saveStoredReminders(list);

  // Reschedule notification
  await cancelReminderNotification(updated.notification_id);
  if (!updated.is_completed) {
    await scheduleReminderNotification(updated, currencySymbol);
  }

  return updated;
}

/**
 * Toggle completed state of a reminder
 */
export async function toggleReminderCompletion(id: string, currencySymbol: string = '৳'): Promise<TaskReminder | null> {
  const list = getStoredReminders();
  const item = list.find((r) => r.id === id);
  if (!item) return null;

  const nextState = !item.is_completed;
  item.is_completed = nextState;
  item.completed_at = nextState ? new Date().toISOString() : undefined;

  saveStoredReminders([...list]);

  if (nextState) {
    await cancelReminderNotification(item.notification_id);
  } else {
    // Re-activated reminder -> schedule lock-screen alert & push to Notification Bell icon
    await scheduleReminderNotification(item, currencySymbol);
  }

  return item;
}

/**
 * Delete a reminder
 */
export async function deleteReminder(id: string): Promise<void> {
  const list = getStoredReminders();
  const item = list.find((r) => r.id === id);
  if (item) {
    await cancelReminderNotification(item.notification_id);
  }
  const filtered = list.filter((r) => r.id !== id);
  saveStoredReminders(filtered);
}

/**
 * Check for reminders and sync them with BOTH the in-app Notification Bell Icon and Phone Lock Screen
 */
export function checkDueReminders(currencySymbol: string = '৳'): void {
  if (typeof window === 'undefined') return;
  const list = getStoredReminders();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Ensure all reminders (including Pay Electric Bill) appear in the in-app Notification Bell icon
  for (const item of list) {
    const { title, body } = buildReminderNotificationPayload(
      item,
      currencySymbol,
      item.due_date <= todayStr ? 'due' : 'scheduled'
    );
    recordInAppNotification(
      {
        type: 'reminder',
        title,
        body,
        reminder_id: item.id,
        category_id: item.category_id,
      },
      `reminder_sync_${item.id}_${item.due_date}`
    );

    // Ensure future uncompleted reminders have their OS lock-screen alarm scheduled
    if (!item.is_completed && item.due_date >= todayStr) {
      scheduleReminderNotification(item, currencySymbol).catch(() => {});
    }
  }

  // 2. Trigger due/overdue reminders on lock screen & in-app Bell icon
  const dueList = list.filter((r) => !r.is_completed && r.due_date <= todayStr);
  if (dueList.length === 0) return;

  for (const item of dueList) {
    const isToday = item.due_date === todayStr;
    const title = isToday ? `⏰ Due Today: ${item.title}` : `⚠️ Overdue: ${item.title}`;
    const amountStr = item.amount ? `Amount: ${currencySymbol}${formatAmount(item.amount)} • ` : '';
    const body = `${amountStr}${item.note || "Don't forget to complete this task!"}`;

    triggerReminderNotificationNow(item, currencySymbol, `reminder_due_daily_${item.id}_${todayStr}`).catch(() => {});

    // Dispatch custom event for UI toast/banner
    window.dispatchEvent(
      new CustomEvent('cashflow-due-reminder-alert', {
        detail: { reminder: item, title, body },
      })
    );
  }
}

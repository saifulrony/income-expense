/**
 * CashFlow Task & Bill Reminders Engine
 * - Custom bill and task reminders (e.g., "Pay electric bill on 30th Nov")
 * - Scheduled notifications via Android Capacitor LocalNotifications & Web Notifications
 * - 1-tap "Log as Expense" conversion into ledger
 * - Offline-first persistent storage
 */

import { formatAmount } from './currency';

export interface TaskReminder {
  id: string;
  title: string;                 // e.g. "Pay electric bill"
  amount?: number;               // e.g. 1500
  due_date: string;              // YYYY-MM-DD
  due_time?: string;             // HH:mm (default "09:00")
  note?: string;                 // e.g. "dont forget!"
  category_id?: string;          // optional category link
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  notification_id: number;       // integer ID for local-notifications
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
 * Schedule native/web notification for a reminder
 */
async function scheduleReminderNotification(reminder: TaskReminder, currencySymbol: string = '৳'): Promise<void> {
  if (typeof window === 'undefined' || reminder.is_completed) return;

  const [year, month, day] = reminder.due_date.split('-').map(Number);
  const [hour, minute] = (reminder.due_time || '09:00').split(':').map(Number);
  const scheduleTime = new Date(year, month - 1, day, hour || 9, minute || 0, 0, 0);

  // If already in past by more than 1 hour, don't schedule OS notification
  if (scheduleTime.getTime() < Date.now() - 3600000) {
    return;
  }

  const title = `⏰ Reminder: ${reminder.title}`;
  const amountStr = reminder.amount && reminder.amount > 0 ? `${currencySymbol}${formatAmount(reminder.amount)} • ` : '';
  const body = `${amountStr}${reminder.note ? `${reminder.note} — ` : ''}Due today! Don't forget!`;

  // 1. Android Native via Capacitor
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [
          {
            id: reminder.notification_id,
            title,
            body,
            schedule: { at: scheduleTime.getTime() > Date.now() ? scheduleTime : new Date(Date.now() + 1000) },
            extra: { reminderId: reminder.id },
          },
        ],
      });
      return;
    }
  } catch (err) {
    console.warn('Could not schedule Capacitor reminder notification', err);
  }

  // 2. Web fallback (if permission granted and within active session timer)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const delay = scheduleTime.getTime() - Date.now();
    if (delay > 0 && delay < 86400000) {
      setTimeout(() => {
        try {
          new Notification(title, { body, icon: '/icon.svg' });
        } catch {
          // ignore
        }
      }, delay);
    }
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
        notifications: [{ id: notificationId }],
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
export async function toggleReminderCompletion(id: string): Promise<TaskReminder | null> {
  const list = getStoredReminders();
  const item = list.find((r) => r.id === id);
  if (!item) return null;

  const nextState = !item.is_completed;
  item.is_completed = nextState;
  item.completed_at = nextState ? new Date().toISOString() : undefined;

  saveStoredReminders([...list]);

  if (nextState) {
    await cancelReminderNotification(item.notification_id);
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
 * Check for due reminders and trigger active notifications
 */
export function checkDueReminders(currencySymbol: string = '৳'): void {
  if (typeof window === 'undefined') return;
  const list = getStoredReminders();
  const todayStr = new Date().toISOString().slice(0, 10);

  const dueList = list.filter((r) => !r.is_completed && r.due_date <= todayStr);
  if (dueList.length === 0) return;

  // Record an in-app notice for due reminders
  for (const item of dueList) {
    const isToday = item.due_date === todayStr;
    const title = isToday ? `⏰ Due Today: ${item.title}` : `⚠️ Overdue: ${item.title}`;
    const amountStr = item.amount ? `Amount: ${currencySymbol}${formatAmount(item.amount)} • ` : '';
    const body = `${amountStr}${item.note || "Don't forget to complete this task!"}`;

    // Dispatch custom event for UI toast/banner
    window.dispatchEvent(
      new CustomEvent('cashflow-due-reminder-alert', {
        detail: { reminder: item, title, body },
      })
    );
  }
}

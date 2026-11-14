import { Preferences } from '@capacitor/preferences';
import { api } from './api';

export interface PendingTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  payment_method: string;
  note: string;
  receipt_image?: string;
  date: string;
  created_at: string;
}

const OFFLINE_QUEUE_KEY = 'offline_tx_queue';

export class OfflineSyncService {
  static async getQueue(): Promise<PendingTransaction[]> {
    try {
      const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      if (value) {
        return JSON.parse(value);
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) return JSON.parse(raw);
    }
    return [];
  }

  static async enqueue(tx: PendingTransaction): Promise<void> {
    const queue = await this.getQueue();
    queue.push(tx);
    const jsonStr = JSON.stringify(queue);

    try {
      await Preferences.set({ key: OFFLINE_QUEUE_KEY, value: jsonStr });
    } catch (e) {}

    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, jsonStr);
    }
  }

  static async clearQueue(): Promise<void> {
    try {
      await Preferences.remove({ key: OFFLINE_QUEUE_KEY });
    } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  }

  // Attempt to sync all pending offline transactions to the Go backend
  static async sync(): Promise<number> {
    const queue = await this.getQueue();
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    const remaining: PendingTransaction[] = [];

    for (const item of queue) {
      try {
        await api.createTransaction({
          amount: item.amount,
          type: item.type,
          category_id: item.category_id,
          payment_method: item.payment_method,
          note: item.note,
          receipt_image: item.receipt_image,
          date: item.date,
        });
        syncedCount++;
      } catch (err) {
        // Keep in queue to retry next time
        remaining.push(item);
      }
    }

    if (remaining.length > 0) {
      const jsonStr = JSON.stringify(remaining);
      try {
        await Preferences.set({ key: OFFLINE_QUEUE_KEY, value: jsonStr });
      } catch (e) {}
      if (typeof window !== 'undefined') {
        localStorage.setItem(OFFLINE_QUEUE_KEY, jsonStr);
      }
    } else {
      await this.clearQueue();
    }

    return syncedCount;
  }
}


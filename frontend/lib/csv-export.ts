/**
 * Universal CSV Export Utility for CashFlow
 * Ensures reliable cross-browser file downloads across mobile & desktop browsers.
 */

import { Transaction, CategoryBreakdown } from './types';

/**
 * Triggers a cross-browser file download from string content.
 * Safely appends an anchor to document.body and delays revokeObjectURL to prevent silent download failures.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Add UTF-8 BOM so Excel and other spreadsheet viewers render Unicode / UTF-8 characters correctly
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });

    // Legacy IE/Edge support
    if ((window.navigator as any).msSaveBlob) {
      (window.navigator as any).msSaveBlob(blob, filename);
      return true;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    link.style.visibility = 'hidden';
    link.setAttribute('aria-hidden', 'true');

    document.body.appendChild(link);
    link.click();

    // Delay cleanup so asynchronous browser download managers can complete loading the blob
    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore any detached element errors during teardown
      }
    }, 600);

    return true;
  } catch (error) {
    console.error('Error during file download execution:', error);
    return false;
  }
}

/**
 * Safely extracts date (YYYY-MM-DD) and time (HH:MM:SS) strings without crashing on bad date inputs.
 */
function parseDateTimeSafe(val: any): { date: string; time: string } {
  if (!val) return { date: '', time: '' };
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      const s = String(val);
      return { date: s.slice(0, 10), time: '' };
    }
    const date = d.toISOString().slice(0, 10);
    const time = d.toTimeString().slice(0, 8);
    return { date, time };
  } catch {
    return { date: String(val || ''), time: '' };
  }
}

/**
 * Escape a cell value for CSV format (RFC 4180).
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export a list of transactions to CSV format and trigger instant browser download.
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  filename?: string,
  currency: string = 'BDT'
): { success: boolean; count: number; error?: string } {
  if (!transactions || transactions.length === 0) {
    return { success: false, count: 0, error: 'No transactions to export.' };
  }

  try {
    const headers = [
      'Date',
      'Time',
      'Type',
      'Category',
      'Amount',
      'Currency',
      'Payment Method',
      'Account',
      'Note',
      'Receipt'
    ];

    const rows = transactions.map((tx) => {
      const { date, time } = parseDateTimeSafe(tx.date);
      const typeStr = (tx.type || 'expense').toUpperCase();
      const catName = tx.category?.name || 'Uncategorized';
      const amountVal = Number(tx.amount || 0).toFixed(2);
      const methodStr = tx.payment_method || 'Cash';
      const accountStr = tx.account?.name || '';
      const noteStr = tx.note || '';
      const receiptStr = tx.receipt_image ? 'Yes' : 'No';

      return [
        escapeCSV(date),
        escapeCSV(time),
        escapeCSV(typeStr),
        escapeCSV(catName),
        amountVal,
        escapeCSV(currency),
        escapeCSV(methodStr),
        escapeCSV(accountStr),
        escapeCSV(noteStr),
        escapeCSV(receiptStr)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const safeFilename = filename
      ? (filename.endsWith('.csv') ? filename : `${filename}.csv`)
      : `transactions_${new Date().toISOString().slice(0, 10)}.csv`;

    const ok = downloadFile(csvContent, safeFilename);
    return { success: ok, count: transactions.length, error: ok ? undefined : 'Browser download failed' };
  } catch (err: any) {
    console.error('Failed to export transactions to CSV:', err);
    return { success: false, count: 0, error: err?.message || 'Export error' };
  }
}

/**
 * Export analytics category spending / income breakdown to CSV format.
 */
export function exportCategoryBreakdownToCSV(
  breakdowns: CategoryBreakdown[],
  type: 'expense' | 'income' = 'expense',
  period: string = 'all',
  currency: string = 'BDT'
): { success: boolean; count: number; error?: string } {
  if (!breakdowns || breakdowns.length === 0) {
    return { success: false, count: 0, error: 'No category data to export.' };
  }

  try {
    const headers = ['Category', 'Type', 'Amount', 'Currency', 'Percentage (%)', 'Transactions Count'];
    const typeLabel = type.toUpperCase();

    const rows = breakdowns.map((b) => [
      escapeCSV(b.category_name),
      escapeCSV(typeLabel),
      Number(b.total_amount || 0).toFixed(2),
      escapeCSV(currency),
      Number(b.percentage || 0).toFixed(1) + '%',
      b.count || 0
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const safeFilename = `category_${type}_breakdown_${period}_${new Date().toISOString().slice(0, 10)}.csv`;

    const ok = downloadFile(csvContent, safeFilename);
    return { success: ok, count: breakdowns.length, error: ok ? undefined : 'Browser download failed' };
  } catch (err: any) {
    console.error('Failed to export category breakdown to CSV:', err);
    return { success: false, count: 0, error: err?.message || 'Export error' };
  }
}

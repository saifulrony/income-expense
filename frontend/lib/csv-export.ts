/**
 * Universal File & CSV Export Utility for CashFlow
 * Ensures reliable file downloads across:
 * 1. Native Android / iOS (via Capacitor Filesystem & native Share Sheet: Save to Downloads/Files, Sheets, Drive)
 * 2. Mobile & Desktop Web Browsers (via Blob URL & <a> download)
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Transaction, CategoryBreakdown } from './types';

/**
 * Universal file saver.
 * - On Native Android (Capacitor): writes file to Cache & Documents and invokes Android Share sheet.
 * - On Web: triggers browser download via Blob and <a download>.
 */
export async function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;',
  isBase64: boolean = false
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Native Capacitor App (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      // Write to Cache directory (guaranteed accessible by Android FileProvider)
      const cacheResult = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: isBase64 ? undefined : Encoding.UTF8,
      });

      // Also save to Documents directory for permanent local storage
      try {
        await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: isBase64 ? undefined : Encoding.UTF8,
        });
      } catch (docErr) {
        console.warn('Documents write skipped, cache retained:', docErr);
      }

      // Open native Android Share sheet (Save to Downloads, Drive, Sheets, WhatsApp, etc.)
      try {
        await Share.share({
          title: filename,
          text: `CashFlow Export: ${filename}`,
          url: cacheResult.uri,
          dialogTitle: `Save or Export ${filename}`,
        });
      } catch (shareErr: any) {
        // User cancelling or dismissing the share sheet is normal behavior
        console.log('Native share dialog closed or dismissed:', shareErr);
      }

      return true;
    } catch (nativeErr) {
      console.error('Native file save error:', nativeErr);
      // Fallback to web blob download below
    }
  }

  // 2. Web Browser Fallback (Desktop & Mobile Web)
  try {
    let blob: Blob;
    if (isBase64) {
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      blob = new Blob(['\uFEFF' + content], { type: mimeType });
    }

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

    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore detached element errors during teardown
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
 * Export a list of transactions to CSV format and trigger instant download / share.
 */
export async function exportTransactionsToCSV(
  transactions: Transaction[],
  filename?: string,
  currency: string = 'BDT'
): Promise<{ success: boolean; count: number; error?: string }> {
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

    const ok = await downloadFile(csvContent, safeFilename);
    return { success: ok, count: transactions.length, error: ok ? undefined : 'Download failed' };
  } catch (err: any) {
    console.error('Failed to export transactions to CSV:', err);
    return { success: false, count: 0, error: err?.message || 'Export error' };
  }
}

/**
 * Export analytics category spending / income breakdown to CSV format.
 */
export async function exportCategoryBreakdownToCSV(
  breakdowns: CategoryBreakdown[],
  type: 'expense' | 'income' = 'expense',
  period: string = 'all',
  currency: string = 'BDT'
): Promise<{ success: boolean; count: number; error?: string }> {
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

    const ok = await downloadFile(csvContent, safeFilename);
    return { success: ok, count: breakdowns.length, error: ok ? undefined : 'Download failed' };
  } catch (err: any) {
    console.error('Failed to export category breakdown to CSV:', err);
    return { success: false, count: 0, error: err?.message || 'Export error' };
  }
}

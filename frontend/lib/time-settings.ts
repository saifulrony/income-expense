export type TimeFormat = '12h' | '24h';
export type TimeMode = 'auto' | 'manual';
export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

const KEY_TIME_FORMAT = 'app_time_format';
const KEY_TIME_MODE = 'app_time_mode';
const KEY_MANUAL_TIME = 'app_manual_time';
const KEY_DATE_FORMAT = 'app_date_format';

export function getTimeFormat(): TimeFormat {
  if (typeof window === 'undefined') return '12h';
  const val = localStorage.getItem(KEY_TIME_FORMAT);
  return val === '24h' ? '24h' : '12h';
}

export function setTimeFormat(format: TimeFormat): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_TIME_FORMAT, format);
  window.dispatchEvent(new Event('app_time_settings_changed'));
}

export function getTimeMode(): TimeMode {
  if (typeof window === 'undefined') return 'auto';
  const val = localStorage.getItem(KEY_TIME_MODE);
  return val === 'manual' ? 'manual' : 'auto';
}

export function setTimeMode(mode: TimeMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_TIME_MODE, mode);
  window.dispatchEvent(new Event('app_time_settings_changed'));
}

export function getManualTime(): string {
  if (typeof window === 'undefined') return '12:00';
  const val = localStorage.getItem(KEY_MANUAL_TIME);
  return val && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val) ? val : '12:00';
}

export function setManualTime(timeStr: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_MANUAL_TIME, timeStr);
  window.dispatchEvent(new Event('app_time_settings_changed'));
}

export function getDateFormat(): DateFormat {
  if (typeof window === 'undefined') return 'YYYY-MM-DD';
  const val = localStorage.getItem(KEY_DATE_FORMAT);
  if (val === 'DD/MM/YYYY' || val === 'MM/DD/YYYY') return val;
  return 'YYYY-MM-DD';
}

export function setDateFormat(format: DateFormat): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_DATE_FORMAT, format);
  window.dispatchEvent(new Event('app_time_settings_changed'));
}

export function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    return 'UTC';
  }
}

/**
 * Returns the effective application current time based on whether
 * Automatic (device system clock) or Manual (custom preset time) is configured.
 */
export function getEffectiveCurrentTime(): Date {
  const now = new Date();
  if (getTimeMode() === 'manual') {
    const manualStr = getManualTime();
    const parts = manualStr.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        now.setHours(hours, minutes, 0, 0);
      }
    }
  }
  return now;
}

/**
 * Format a Date object (or timestamp) into YYYY-MM-DD using the user's local timezone.
 * Avoids UTC boundary shifts caused by Date.prototype.toISOString().slice(0, 10).
 */
export function formatLocalDate(date: Date | string | number = new Date()): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get standard HH:mm string for current time (used in <input type="time" />)
 */
export function getCurrentTimeInputValue(): string {
  const d = getEffectiveCurrentTime();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Checks whether a date string has an explicit time component
 * (not date-only YYYY-MM-DD and not midnight UTC).
 */
export function hasExplicitTime(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  // Pure date-only string e.g. "2026-11-15"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  // Midnight UTC timestamp e.g. "2026-11-15T00:00:00.000Z" or "2026-11-15T00:00:00Z"
  if (/T00:00:00(\.0+)?(Z|\+00:00)?$/i.test(trimmed)) return false;
  // Has hour and minute separator
  return trimmed.includes(':') || (trimmed.includes('T') && !trimmed.endsWith('T00:00:00'));
}

/**
 * Format a given Date or ISO date string into the user's preferred time format:
 * - '12h': '02:30 PM' or '09:05 AM'
 * - '24h': '14:30' or '09:05'
 *
 * NOTE: If a date-only string (e.g. "2026-11-15") or midnight UTC is passed,
 * returns '' (empty string) to prevent false timezone-offset artifacts like "06:00 AM".
 */
export function formatTime(dateInput: Date | string | number, format?: TimeFormat): string {
  try {
    if (typeof dateInput === 'string' && !hasExplicitTime(dateInput)) {
      return '';
    }

    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    const effectiveFormat = format || getTimeFormat();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const mm = String(minutes).padStart(2, '0');

    if (effectiveFormat === '24h') {
      const hh = String(hours).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    // 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const hh = String(h12).padStart(2, '0');
    return `${hh}:${mm} ${period}`;
  } catch (e) {
    return '';
  }
}

/**
 * Smartly formats a transaction's time:
 * 1. If tx.date has an explicit time (user selected a time or API returned a full timestamp), formats it.
 * 2. If tx.date is date-only (or midnight UTC) but tx.created_at has an explicit creation time,
 *    formats tx.created_at so the user sees when the transaction was actually recorded.
 * 3. Otherwise returns '' (empty string), avoiding false "06:00 AM" timezone offset artifacts.
 */
export function formatTransactionTime(
  txOrDate?: { date?: string; created_at?: string } | string | Date | null,
  format?: TimeFormat
): string {
  if (!txOrDate) return '';

  if (txOrDate instanceof Date) {
    return formatTime(txOrDate, format);
  }

  if (typeof txOrDate === 'string') {
    if (!hasExplicitTime(txOrDate)) return '';
    return formatTime(txOrDate, format);
  }

  const { date, created_at } = txOrDate;

  // 1. Check if tx.date has a real time component
  if (date && hasExplicitTime(date)) {
    const formatted = formatTime(date, format);
    if (formatted) return formatted;
  }

  // 2. Fall back to tx.created_at if available
  if (created_at && hasExplicitTime(created_at)) {
    const formatted = formatTime(created_at, format);
    if (formatted) return formatted;
  }

  return '';
}

/**
 * Format date according to preferred date format:
 * - 'YYYY-MM-DD': '2026-11-15'
 * - 'DD/MM/YYYY': '15/11/2026'
 * - 'MM/DD/YYYY': '11/15/2026'
 */
export function formatDate(dateInput: Date | string | number, format?: DateFormat): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    const effectiveFormat = format || getDateFormat();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    if (effectiveFormat === 'DD/MM/YYYY') {
      return `${dd}/${mm}/${yyyy}`;
    }
    if (effectiveFormat === 'MM/DD/YYYY') {
      return `${mm}/${dd}/${yyyy}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return '';
  }
}

/**
 * Format date and time together (e.g. "Nov 15 • 02:30 PM")
 */
export function formatDateTime(dateInput: Date | string | number, timeFmt?: TimeFormat): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const timePart = formatTime(d, timeFmt);
    return timePart ? `${datePart} • ${timePart}` : datePart;
  } catch (e) {
    return '';
  }
}

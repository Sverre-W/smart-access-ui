import { formatISO, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Formats a Date as a local ISO 8601 string with the browser's UTC offset,
 * e.g. "2026-03-01T16:00:00+08:00".
 *
 * Use this instead of Date.toISOString() when sending datetimes to the server
 * so the server receives both the local wall-clock time and the UTC offset.
 */
export function toLocalIso(date: Date): string {
  return formatISO(date);
}

/**
 * Parses an ISO string from the server and returns a Date representing the
 * same instant in the browser's local timezone, ready for display or use in
 * a date picker.
 *
 * Works correctly for both offset-aware strings ("2026-03-01T16:00:00+08:00")
 * and UTC strings ("2026-03-01T08:00:00Z") — both are converted to local time.
 */
export function fromServerDate(isoString: string): Date {
  const parsed = parseISO(isoString);
  return toZonedTime(parsed, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * Formats a Date (or ISO string) for display in local time.
 * Returns a short datetime string, e.g. "1 Mar 2026, 16:00".
 */
export function formatLocalDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a Date (or ISO string) as a local time-only string, e.g. "16:00".
 */
export function formatLocalTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

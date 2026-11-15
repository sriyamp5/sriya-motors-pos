export { formatMoney } from '@shared/money.js';

/** Today's date as YYYY-MM-DD in local time. */
export const todayIso = () => toIsoDate(new Date());

export function toIsoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toIsoDate(date);
}

export const firstOfMonthIso = () => {
  const date = new Date();
  date.setDate(1);
  return toIsoDate(date);
};

/** Parses "YYYY-MM-DD HH:MM:SS" (database local time) or ISO strings. */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(String(value).replace(' ', 'T'));
}

export function formatDate(value) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${formatDate(date)}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export function formatTime(value) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export const formatNumber = (value) => new Intl.NumberFormat('en-LK').format(Number(value) || 0);

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string safely.
 * If it's a YYYY-MM-DD string, it parses it manually to avoid timezone shifts.
 */
export function formatDate(
  dateStr: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  },
) {
  if (!dateStr) return '';

  const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString();

  // If it's just YYYY-MM-DD, parse manually to avoid timezone shift (UTC midnight -> local yesterday)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.slice(0, 10)) && str.length <= 10) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', options);
  }

  // Otherwise it's a full timestamp or Date object
  return new Date(dateStr).toLocaleDateString('es-PE', options);
}

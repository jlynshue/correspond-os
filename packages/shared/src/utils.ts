import { randomUUID } from 'node:crypto';

/** Generate a unique ID */
export function generateId(): string {
  return randomUUID();
}

/** Calculate days between two dates */
export function daysBetween(from: Date, to: Date = new Date()): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Truncate a string to a max length with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
}

/** Normalize an email address for comparison */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Extract domain from email */
export function emailDomain(email: string): string {
  const parts = email.split('@');
  return parts[1]?.toLowerCase() ?? '';
}

/** Safe JSON parse with fallback */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/** Format a date as ISO date string (YYYY-MM-DD) */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/** Format a date as a human-readable relative string */
export function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return toDateString(date);
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

import type { NormalizedMessage } from '@correspond-os/shared';
import { daysBetween } from '@correspond-os/shared';

/**
 * Compute time sensitivity score (0.0 - 1.0)
 *
 * Scoring logic:
 * - Deadline today signal: 1.0
 * - "urgent" in urgency signals: 0.9
 * - Meeting follow-up within 24h: 0.8
 * - Stale deal (>3 days): 0.7
 * - Token expiring: 0.7
 * - CI failure: 0.6
 * - General unread (age-based decay): 0.3 - 0.6
 */
export function computeTimeSensitivity(message: NormalizedMessage): number {
  const signals = message.urgencySignals;

  if (signals.includes('deadline-today')) return 1.0;
  if (signals.includes('mentions-urgent')) return 0.9;
  if (signals.includes('meeting-followup')) return 0.8;
  if (signals.includes('stale-deal')) return 0.7;
  if (signals.includes('token-expiring')) return 0.7;
  if (signals.includes('ci-failure')) return 0.6;

  // Age-based decay: newer messages are more time-sensitive
  const age = daysBetween(message.timestamp);
  if (age === 0) return 0.5;
  if (age === 1) return 0.4;
  if (age <= 3) return 0.35;
  return 0.3;
}

import type { NormalizedMessage } from '@correspond-os/shared';
import { CHANNEL_URGENCY_SCORES } from '@correspond-os/shared';

/**
 * Compute channel urgency score (0.0 - 1.0)
 *
 * LinkedIn DMs and Slack messages score highest (ephemeral, easy to miss).
 * Email scores medium. Task/wiki systems score lowest.
 *
 * Boosted by flags:
 * - flagged: +0.1
 * - high-importance: +0.1
 */
export function computeChannelUrgency(message: NormalizedMessage): number {
  let base = CHANNEL_URGENCY_SCORES[message.channel] ?? 0.5;

  if (message.urgencySignals.includes('flagged')) {
    base = Math.min(base + 0.1, 1.0);
  }
  if (message.urgencySignals.includes('high-importance')) {
    base = Math.min(base + 0.1, 1.0);
  }

  return base;
}

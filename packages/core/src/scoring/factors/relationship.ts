import type { NormalizedMessage } from '@correspond-os/shared';
import { RELATIONSHIP_TIER_SCORES } from '@correspond-os/shared';

/**
 * Compute relationship tier score (0.0 - 1.0)
 *
 * Uses the relationship tier directly mapped to scores.
 */
export function computeRelationshipScore(message: NormalizedMessage): number {
  return RELATIONSHIP_TIER_SCORES[message.relationshipTier] ?? 0.2;
}

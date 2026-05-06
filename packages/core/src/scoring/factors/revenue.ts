import type { NormalizedMessage } from '@correspond-os/shared';

/**
 * Compute revenue impact score (0.0 - 1.0)
 *
 * Scoring logic:
 * - Has HubSpot deal in negotiation/proposal stage: 0.9
 * - Has active HubSpot deal (any stage): 0.6
 * - Has fundraising-related urgency signal: 0.8
 * - Has deal-related metadata: 0.5
 * - No deal association: 0.2
 */
export function computeRevenueImpact(message: NormalizedMessage): number {
  // Check for deal association
  if (message.hubspotDealId) {
    const stage = message.metadata?.dealStage as string | undefined;
    if (stage && ['negotiation', 'proposal', 'contractsent'].includes(stage.toLowerCase())) {
      return 0.9;
    }
    return 0.6;
  }

  // Check for fundraising signals
  const hasFundraisingSignal = message.urgencySignals.some(
    (s) => s === 'custom' && message.metadata?.fundraising === true,
  );
  if (hasFundraisingSignal) return 0.8;

  // Check for deal-related metadata
  if (message.metadata?.hasDeal || message.metadata?.pipeline) return 0.5;

  // Default: no revenue signal
  return 0.2;
}

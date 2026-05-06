import type { ScoringWeights } from './types.js';

/** Default scoring weights — sum to 1.0 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  revenueImpact: 0.4,
  timeSensitivity: 0.3,
  relationshipTier: 0.2,
  channelUrgency: 0.1,
};

/** Score thresholds for bucketing */
export const BUCKET_THRESHOLDS = {
  today: 0.7,
  tomorrow: 0.4,
  thisWeek: 0.0, // anything below tomorrow threshold
} as const;

/** Channel urgency base scores */
export const CHANNEL_URGENCY_SCORES: Record<string, number> = {
  linkedin: 1.0,
  slack: 0.95,
  outlook: 0.85,
  gmail: 0.8,
  hubspot: 0.7,
  confluence: 0.4,
  'super-productivity': 0.3,
  obsidian: 0.2,
  github: 0.6,
  custom: 0.5,
} as const;

/** Relationship tier scores */
export const RELATIONSHIP_TIER_SCORES: Record<string, number> = {
  customer: 1.0,
  partner: 0.9,
  opportunity: 0.8,
  internal: 0.7,
  lead: 0.5,
  subscriber: 0.3,
  unknown: 0.2,
} as const;

/** Staleness thresholds */
export const STALENESS = {
  urgentDays: 7,
  followUpDays: 3,
  defaultDays: 2,
} as const;

/** App metadata */
export const APP = {
  name: 'correspond-os',
  displayName: 'CorrespondOS',
  version: '0.1.0',
  description: 'Multi-channel correspondence triage engine',
} as const;

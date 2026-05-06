import { z } from 'zod';

// ─── Channel Definitions ────────────────────────────────────────────────────

export const ChannelSchema = z.enum([
  'gmail',
  'outlook',
  'hubspot',
  'apollo',
  'linkedin',
  'confluence',
  'slack',
  'super-productivity',
  'obsidian',
  'github',
  'custom',
]);

export type Channel = z.infer<typeof ChannelSchema>;

// ─── Priority Bucket ────────────────────────────────────────────────────────

export const PriorityBucketSchema = z.enum(['today', 'tomorrow', 'this-week', 'backlog']);

export type PriorityBucket = z.infer<typeof PriorityBucketSchema>;

// ─── Urgency Signals ────────────────────────────────────────────────────────

export const UrgencySignalSchema = z.enum([
  'deadline-today',
  'flagged',
  'high-importance',
  'mentions-urgent',
  'meeting-followup',
  'stale-deal',
  'unread-dm',
  'ci-failure',
  'token-expiring',
  'custom',
]);

export type UrgencySignal = z.infer<typeof UrgencySignalSchema>;

// ─── Relationship Tier ──────────────────────────────────────────────────────

export const RelationshipTierSchema = z.enum([
  'customer',
  'opportunity',
  'partner',
  'lead',
  'subscriber',
  'internal',
  'unknown',
]);

export type RelationshipTier = z.infer<typeof RelationshipTierSchema>;

// ─── Normalized Message ─────────────────────────────────────────────────────

export const NormalizedMessageSchema = z.object({
  id: z.string(),
  source: ChannelSchema,
  sourceMessageId: z.string().optional(),
  contactName: z.string(),
  contactEmail: z.string().email().optional(),
  company: z.string().optional(),
  subject: z.string(),
  bodySnippet: z.string().optional(),
  timestamp: z.coerce.date(),
  channel: ChannelSchema,
  hubspotDealId: z.string().optional(),
  urgencySignals: z.array(UrgencySignalSchema).default([]),
  relationshipTier: RelationshipTierSchema.default('unknown'),
  metadata: z.record(z.unknown()).default({}),
});

export type NormalizedMessage = z.infer<typeof NormalizedMessageSchema>;

// ─── Scored Item ────────────────────────────────────────────────────────────

export const ScoredItemSchema = NormalizedMessageSchema.extend({
  score: z.number().min(0).max(1),
  bucket: PriorityBucketSchema,
  scoreBreakdown: z.object({
    revenueImpact: z.number().min(0).max(1),
    timeSensitivity: z.number().min(0).max(1),
    relationshipTier: z.number().min(0).max(1),
    channelUrgency: z.number().min(0).max(1),
  }),
  mergedFrom: z.array(z.string()).default([]),
  syncMismatch: z.boolean().default(false),
});

export type ScoredItem = z.infer<typeof ScoredItemSchema>;

// ─── Draft Response ─────────────────────────────────────────────────────────

export const DraftResponseSchema = z.object({
  itemId: z.string(),
  subject: z.string(),
  body: z.string(),
  channel: ChannelSchema,
  templateUsed: z.string().optional(),
  tone: z.enum(['professional', 'warm', 'collaborative', 'data-driven']),
  status: z.enum(['draft', 'approved', 'sent', 'skipped']).default('draft'),
  createdAt: z.coerce.date(),
  sentAt: z.coerce.date().optional(),
});

export type DraftResponse = z.infer<typeof DraftResponseSchema>;

// ─── Correspondence Queue ───────────────────────────────────────────────────

export const CorrespondenceQueueSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
  totalIngested: z.number(),
  afterDedup: z.number(),
  items: z.array(ScoredItemSchema),
  drafts: z.array(DraftResponseSchema).default([]),
  channelStatus: z.record(ChannelSchema, z.enum(['connected', 'unavailable', 'degraded'])),
  syncMismatches: z.number().default(0),
});

export type CorrespondenceQueue = z.infer<typeof CorrespondenceQueueSchema>;

// ─── Adapter Interface ──────────────────────────────────────────────────────

export interface ChannelAdapter {
  readonly name: Channel;
  readonly displayName: string;
  readonly version: string;

  /** Check if the adapter can connect */
  healthCheck(): Promise<AdapterHealthResult>;

  /** Ingest messages from this channel */
  ingest(options: IngestOptions): Promise<NormalizedMessage[]>;

  /** Send a draft via this channel (optional — some channels are read-only) */
  send?(draft: DraftResponse): Promise<SendResult>;
}

export interface AdapterHealthResult {
  status: 'healthy' | 'degraded' | 'unavailable';
  message: string;
  latencyMs?: number;
  lastChecked: Date;
}

export interface IngestOptions {
  since?: Date;
  maxResults?: number;
  filters?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: Channel;
  sentAt: Date;
}

// ─── Scoring Configuration ──────────────────────────────────────────────────

export const ScoringWeightsSchema = z.object({
  revenueImpact: z.number().min(0).max(1).default(0.4),
  timeSensitivity: z.number().min(0).max(1).default(0.3),
  relationshipTier: z.number().min(0).max(1).default(0.2),
  channelUrgency: z.number().min(0).max(1).default(0.1),
});

export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

// ─── Harness Types ──────────────────────────────────────────────────────────

export interface HarnessState {
  phase: 'setup' | 'develop' | 'test' | 'validate' | 'document' | 'complete';
  iteration: number;
  criteria: HarnessCriterion[];
  evidence: HarnessEvidence[];
  decisions: HarnessDecision[];
  startedAt: Date;
  lastUpdatedAt: Date;
}

export interface HarnessCriterion {
  id: string;
  description: string;
  category: 'functional' | 'quality' | 'documentation' | 'testing' | 'performance';
  met: boolean;
  evidence?: string;
  verifiedAt?: Date;
}

export interface HarnessEvidence {
  id: string;
  type: 'test-result' | 'coverage' | 'benchmark' | 'review' | 'screenshot' | 'log';
  description: string;
  artifact: string;
  createdAt: Date;
  iteration: number;
}

export interface HarnessDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  madeAt: Date;
  madeBy: string;
  iteration: number;
}

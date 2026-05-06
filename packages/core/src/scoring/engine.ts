import type { NormalizedMessage, ScoredItem, ScoringWeights, PriorityBucket } from '@correspond-os/shared';
import { DEFAULT_SCORING_WEIGHTS, BUCKET_THRESHOLDS } from '@correspond-os/shared';
import { clamp } from '@correspond-os/shared';
import { computeRevenueImpact } from './factors/revenue.js';
import { computeTimeSensitivity } from './factors/time.js';
import { computeRelationshipScore } from './factors/relationship.js';
import { computeChannelUrgency } from './factors/channel.js';

export class ScoreEngine {
  private weights: ScoringWeights;

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
    this.validateWeights();
  }

  /** Score a single normalized message */
  score(message: NormalizedMessage): ScoredItem {
    const revenueImpact = computeRevenueImpact(message);
    const timeSensitivity = computeTimeSensitivity(message);
    const relationshipTier = computeRelationshipScore(message);
    const channelUrgency = computeChannelUrgency(message);

    const rawScore =
      revenueImpact * this.weights.revenueImpact +
      timeSensitivity * this.weights.timeSensitivity +
      relationshipTier * this.weights.relationshipTier +
      channelUrgency * this.weights.channelUrgency;

    const score = clamp(rawScore, 0, 1);
    const bucket = this.assignBucket(score);

    return {
      ...message,
      score,
      bucket,
      scoreBreakdown: {
        revenueImpact,
        timeSensitivity,
        relationshipTier,
        channelUrgency,
      },
      mergedFrom: [],
      syncMismatch: false,
    };
  }

  /** Score multiple messages and sort by priority */
  scoreAll(messages: NormalizedMessage[]): ScoredItem[] {
    return messages.map((m) => this.score(m)).sort((a, b) => b.score - a.score);
  }

  /** Assign a priority bucket based on score */
  private assignBucket(score: number): PriorityBucket {
    if (score >= BUCKET_THRESHOLDS.today) return 'today';
    if (score >= BUCKET_THRESHOLDS.tomorrow) return 'tomorrow';
    return 'this-week';
  }

  /** Validate weights sum to ~1.0 */
  private validateWeights(): void {
    const sum =
      this.weights.revenueImpact +
      this.weights.timeSensitivity +
      this.weights.relationshipTier +
      this.weights.channelUrgency;

    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(
        `Scoring weights must sum to 1.0 (got ${sum.toFixed(3)}). ` +
          `Current: revenue=${this.weights.revenueImpact}, time=${this.weights.timeSensitivity}, ` +
          `relationship=${this.weights.relationshipTier}, channel=${this.weights.channelUrgency}`,
      );
    }
  }
}

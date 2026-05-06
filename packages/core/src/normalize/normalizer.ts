import type { NormalizedMessage } from '@correspond-os/shared';
import { NormalizedMessageSchema } from '@correspond-os/shared';
import { generateId } from '@correspond-os/shared';

/**
 * Normalizer transforms raw channel-specific messages into
 * the unified NormalizedMessage format.
 */
export class Normalizer {
  /**
   * Normalize a raw message object from any channel adapter.
   * Validates against the schema and assigns an ID if missing.
   */
  normalize(raw: Partial<NormalizedMessage> & { source: string; subject: string }): NormalizedMessage {
    const withId = {
      id: raw.id ?? generateId(),
      contactName: raw.contactName ?? 'Unknown',
      timestamp: raw.timestamp ?? new Date(),
      channel: raw.source,
      urgencySignals: raw.urgencySignals ?? [],
      relationshipTier: raw.relationshipTier ?? 'unknown',
      metadata: raw.metadata ?? {},
      ...raw,
    };

    return NormalizedMessageSchema.parse(withId);
  }

  /**
   * Normalize a batch of raw messages, skipping invalid ones.
   * Returns both successful normalizations and errors.
   */
  normalizeBatch(
    raws: Array<Partial<NormalizedMessage> & { source: string; subject: string }>,
  ): { messages: NormalizedMessage[]; errors: Array<{ raw: unknown; error: string }> } {
    const messages: NormalizedMessage[] = [];
    const errors: Array<{ raw: unknown; error: string }> = [];

    for (const raw of raws) {
      try {
        messages.push(this.normalize(raw));
      } catch (err) {
        errors.push({
          raw,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { messages, errors };
  }
}

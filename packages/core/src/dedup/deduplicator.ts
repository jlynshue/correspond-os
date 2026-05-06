import type { NormalizedMessage } from '@correspond-os/shared';
import { normalizeEmail } from '@correspond-os/shared';

export interface DeduplicatorOptions {
  /** Prefer merging by email (true) or by name (false) */
  preferEmailMatch: boolean;
  /** Time window in ms for subject-based dedup (same contact, same topic) */
  subjectWindowMs: number;
}

const DEFAULT_OPTIONS: DeduplicatorOptions = {
  preferEmailMatch: true,
  subjectWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Deduplicates normalized messages by:
 * 1. Email match (primary key)
 * 2. Contact name match (fallback)
 * 3. Same-topic merge (same contact + similar subject within time window)
 *
 * Merged items track their source IDs in `metadata.mergedFrom`.
 */
export class Deduplicator {
  private options: DeduplicatorOptions;

  constructor(options?: Partial<DeduplicatorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Deduplicate a list of messages.
   * Returns deduplicated messages with merged metadata.
   */
  deduplicate(messages: NormalizedMessage[]): NormalizedMessage[] {
    const groups = this.groupByContact(messages);
    const result: NormalizedMessage[] = [];

    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0]!);
        continue;
      }

      // Within a contact group, merge by subject similarity
      const merged = this.mergeGroup(group);
      result.push(...merged);
    }

    return result;
  }

  /** Group messages by contact (email primary, name fallback) */
  private groupByContact(messages: NormalizedMessage[]): Map<string, NormalizedMessage[]> {
    const groups = new Map<string, NormalizedMessage[]>();

    for (const msg of messages) {
      const key = this.contactKey(msg);
      const existing = groups.get(key) ?? [];
      existing.push(msg);
      groups.set(key, existing);
    }

    return groups;
  }

  /** Generate a grouping key for a message */
  private contactKey(msg: NormalizedMessage): string {
    if (this.options.preferEmailMatch && msg.contactEmail) {
      return `email:${normalizeEmail(msg.contactEmail)}`;
    }
    return `name:${msg.contactName.toLowerCase().trim()}`;
  }

  /** Merge messages within a contact group by subject/timing */
  private mergeGroup(group: NormalizedMessage[]): NormalizedMessage[] {
    // Sort by timestamp descending (newest first)
    const sorted = [...group].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const merged: NormalizedMessage[] = [];
    const consumed = new Set<string>();

    for (const msg of sorted) {
      if (consumed.has(msg.id)) continue;

      // Find messages with similar subjects within the time window
      const related = sorted.filter(
        (other) =>
          other.id !== msg.id &&
          !consumed.has(other.id) &&
          Math.abs(msg.timestamp.getTime() - other.timestamp.getTime()) <= this.options.subjectWindowMs &&
          this.subjectsSimilar(msg.subject, other.subject),
      );

      if (related.length > 0) {
        // Merge: keep the newest, aggregate sources
        const allSources = [msg, ...related].map((m) => m.source);
        const mergedMsg: NormalizedMessage = {
          ...msg,
          metadata: {
            ...msg.metadata,
            mergedFrom: [msg.id, ...related.map((r) => r.id)],
            allChannels: [...new Set(allSources)],
          },
          urgencySignals: [...new Set([...msg.urgencySignals, ...related.flatMap((r) => r.urgencySignals)])],
        };
        merged.push(mergedMsg);
        for (const r of related) consumed.add(r.id);
      } else {
        merged.push(msg);
      }

      consumed.add(msg.id);
    }

    return merged;
  }

  /** Check if two subjects are similar enough to merge */
  private subjectsSimilar(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/^(re|fwd|fw):\s*/gi, '')
        .trim();

    const na = normalize(a);
    const nb = normalize(b);

    // Exact match after normalization
    if (na === nb) return true;

    // One contains the other
    if (na.includes(nb) || nb.includes(na)) return true;

    return false;
  }
}

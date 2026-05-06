import { describe, test, expect } from 'bun:test';
import { Deduplicator } from './deduplicator.js';
import type { NormalizedMessage } from '@correspond-os/shared';

function createMessage(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    source: 'gmail',
    contactName: 'Test User',
    contactEmail: 'test@example.com',
    subject: 'Test subject',
    timestamp: new Date(),
    channel: 'gmail',
    urgencySignals: [],
    relationshipTier: 'unknown',
    metadata: {},
    ...overrides,
  };
}

describe('Deduplicator', () => {
  const dedup = new Deduplicator();

  test('single message passes through unchanged', () => {
    const messages = [createMessage()];
    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(1);
  });

  test('merges messages from same contact email', () => {
    const messages = [
      createMessage({ id: 'a', contactEmail: 'leon@dhc.com', subject: 'Partnership' }),
      createMessage({ id: 'b', contactEmail: 'leon@dhc.com', subject: 'Re: Partnership' }),
    ];

    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(1);
    expect((result[0]!.metadata as any).mergedFrom).toContain('a');
    expect((result[0]!.metadata as any).mergedFrom).toContain('b');
  });

  test('does not merge different contacts', () => {
    const messages = [
      createMessage({ contactEmail: 'alice@example.com', subject: 'Hello' }),
      createMessage({ contactEmail: 'bob@example.com', subject: 'Hello' }),
    ];

    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(2);
  });

  test('merges by name when email is missing', () => {
    const dedup = new Deduplicator({ preferEmailMatch: true });
    const messages = [
      createMessage({
        id: 'x',
        contactName: 'Leon Davoyan',
        contactEmail: undefined,
        subject: 'Call tomorrow',
      }),
      createMessage({
        id: 'y',
        contactName: 'Leon Davoyan',
        contactEmail: undefined,
        subject: 'Re: Call tomorrow',
      }),
    ];

    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(1);
  });

  test('does not merge different subjects from same contact', () => {
    const messages = [
      createMessage({ contactEmail: 'leon@dhc.com', subject: 'Partnership proposal' }),
      createMessage({ contactEmail: 'leon@dhc.com', subject: 'Invoice #4521' }),
    ];

    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(2);
  });

  test('strips Re:/Fwd: when comparing subjects', () => {
    const messages = [
      createMessage({ id: 'orig', contactEmail: 'a@b.com', subject: 'Q2 Planning' }),
      createMessage({ id: 'reply', contactEmail: 'a@b.com', subject: 'Re: Q2 Planning' }),
      createMessage({ id: 'fwd', contactEmail: 'a@b.com', subject: 'Fwd: Q2 Planning' }),
    ];

    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(1);
  });

  test('aggregates urgency signals from merged messages', () => {
    const messages = [
      createMessage({
        contactEmail: 'x@y.com',
        subject: 'Deal',
        urgencySignals: ['flagged'],
      }),
      createMessage({
        contactEmail: 'x@y.com',
        subject: 'Re: Deal',
        urgencySignals: ['deadline-today'],
      }),
    ];

    const result = dedup.deduplicate(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.urgencySignals).toContain('flagged');
    expect(result[0]!.urgencySignals).toContain('deadline-today');
  });
});

import { describe, test, expect } from 'bun:test';
import { ScoreEngine } from './engine.js';
import type { NormalizedMessage } from '@correspond-os/shared';

function createMessage(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    id: 'test-1',
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

describe('ScoreEngine', () => {
  const engine = new ScoreEngine();

  test('scores a basic message with default weights', () => {
    const msg = createMessage();
    const result = engine.score(msg);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.bucket).toBeDefined();
    expect(result.scoreBreakdown).toBeDefined();
  });

  test('high-priority message scores >= 0.7 (today bucket)', () => {
    const msg = createMessage({
      hubspotDealId: 'deal-123',
      metadata: { dealStage: 'negotiation' },
      urgencySignals: ['deadline-today'],
      relationshipTier: 'customer',
      channel: 'linkedin',
    });

    const result = engine.score(msg);

    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.bucket).toBe('today');
  });

  test('low-priority message scores < 0.4 (this-week bucket)', () => {
    const msg = createMessage({
      urgencySignals: [],
      relationshipTier: 'unknown',
      channel: 'obsidian',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    });

    const result = engine.score(msg);

    expect(result.score).toBeLessThan(0.4);
    expect(result.bucket).toBe('this-week');
  });

  test('scoreAll returns sorted array (highest first)', () => {
    const messages = [
      createMessage({ id: 'low', relationshipTier: 'unknown', channel: 'obsidian' }),
      createMessage({
        id: 'high',
        hubspotDealId: 'deal-1',
        urgencySignals: ['deadline-today'],
        relationshipTier: 'customer',
        channel: 'linkedin',
      }),
      createMessage({ id: 'mid', relationshipTier: 'lead', urgencySignals: ['meeting-followup'] }),
    ];

    const results = engine.scoreAll(messages);

    expect(results[0]!.id).toBe('high');
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    expect(results[1]!.score).toBeGreaterThan(results[2]!.score);
  });

  test('score breakdown factors sum correctly with weights', () => {
    const msg = createMessage();
    const result = engine.score(msg);

    const { revenueImpact, timeSensitivity, relationshipTier, channelUrgency } =
      result.scoreBreakdown;

    const expectedScore =
      revenueImpact * 0.4 + timeSensitivity * 0.3 + relationshipTier * 0.2 + channelUrgency * 0.1;

    expect(Math.abs(result.score - expectedScore)).toBeLessThan(0.01);
  });

  test('throws on invalid weights (sum != 1.0)', () => {
    expect(
      () =>
        new ScoreEngine({
          revenueImpact: 0.5,
          timeSensitivity: 0.5,
          relationshipTier: 0.5,
          channelUrgency: 0.5,
        }),
    ).toThrow('Scoring weights must sum to 1.0');
  });

  test('custom weights change scoring behavior', () => {
    const revenueHeavy = new ScoreEngine({
      revenueImpact: 0.7,
      timeSensitivity: 0.1,
      relationshipTier: 0.1,
      channelUrgency: 0.1,
    });

    const timeHeavy = new ScoreEngine({
      revenueImpact: 0.1,
      timeSensitivity: 0.7,
      relationshipTier: 0.1,
      channelUrgency: 0.1,
    });

    const dealMsg = createMessage({
      hubspotDealId: 'deal-big',
      metadata: { dealStage: 'negotiation' },
    });

    const revenueScore = revenueHeavy.score(dealMsg).score;
    const timeScore = timeHeavy.score(dealMsg).score;

    expect(revenueScore).toBeGreaterThan(timeScore);
  });

  test('flagged messages get channel urgency boost', () => {
    const normal = createMessage({ channel: 'gmail' });
    const flagged = createMessage({ channel: 'gmail', urgencySignals: ['flagged'] });

    const normalResult = engine.score(normal);
    const flaggedResult = engine.score(flagged);

    expect(flaggedResult.scoreBreakdown.channelUrgency).toBeGreaterThan(
      normalResult.scoreBreakdown.channelUrgency,
    );
  });
});

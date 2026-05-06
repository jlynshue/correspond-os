import { describe, test, expect, beforeEach } from 'bun:test';
import { Database } from './database.js';
import type { CorrespondenceQueue, ScoredItem } from '@correspond-os/shared';

function createTestQueue(): CorrespondenceQueue {
  const items: ScoredItem[] = [
    {
      id: 'item-1',
      source: 'gmail',
      contactName: 'Leon Davoyan',
      contactEmail: 'leon@dhc.com',
      company: 'DHC',
      subject: 'Partnership Proposal',
      timestamp: new Date(),
      channel: 'gmail',
      urgencySignals: ['stale-deal'],
      relationshipTier: 'opportunity',
      metadata: {},
      score: 0.85,
      bucket: 'today',
      scoreBreakdown: { revenueImpact: 0.9, timeSensitivity: 0.7, relationshipTier: 0.8, channelUrgency: 0.8 },
      mergedFrom: [],
      syncMismatch: false,
    },
    {
      id: 'item-2',
      source: 'outlook',
      contactName: 'Robert McDonnell',
      contactEmail: 'robert@anuba.com',
      subject: 'Council Review',
      timestamp: new Date(),
      channel: 'outlook',
      urgencySignals: [],
      relationshipTier: 'internal',
      metadata: {},
      score: 0.45,
      bucket: 'tomorrow',
      scoreBreakdown: { revenueImpact: 0.2, timeSensitivity: 0.5, relationshipTier: 0.7, channelUrgency: 0.85 },
      mergedFrom: [],
      syncMismatch: false,
    },
  ];

  return {
    id: 'queue-test-001',
    createdAt: new Date(),
    totalIngested: 10,
    afterDedup: 2,
    items,
    drafts: [],
    channelStatus: { gmail: 'connected', outlook: 'connected' } as any,
    syncMismatches: 0,
  };
}

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database({ path: ':memory:' });
  });

  test('creates tables on init', () => {
    const stats = db.getStats();
    expect(stats.totalQueues).toBe(0);
    expect(stats.totalItems).toBe(0);
  });

  test('saves and retrieves a queue', () => {
    const queue = createTestQueue();
    db.saveQueue(queue);

    const latest = db.getLatestQueue();
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe('queue-test-001');
    expect(latest!.totalIngested).toBe(10);
  });

  test('retrieves items by queue and bucket', () => {
    db.saveQueue(createTestQueue());

    const allItems = db.getItems('queue-test-001');
    expect(allItems).toHaveLength(2);

    const todayItems = db.getItems('queue-test-001', 'today');
    expect(todayItems).toHaveLength(1);
    expect(todayItems[0].contact_name).toBe('Leon Davoyan');

    const tomorrowItems = db.getItems('queue-test-001', 'tomorrow');
    expect(tomorrowItems).toHaveLength(1);
  });

  test('items are sorted by score descending', () => {
    db.saveQueue(createTestQueue());
    const items = db.getItems('queue-test-001');
    expect(items[0].score).toBeGreaterThan(items[1].score);
  });

  test('saves and updates a draft', () => {
    db.saveQueue(createTestQueue());

    const draftId = db.saveDraft({
      itemId: 'item-1',
      queueId: 'queue-test-001',
      subject: 'Re: Partnership',
      body: 'Thanks for reaching out...',
      channel: 'gmail',
      templateUsed: 'follow-up-warm',
      tone: 'professional',
      status: 'draft',
      createdAt: new Date(),
    });

    expect(draftId).toBeDefined();

    db.updateDraftStatus(draftId, 'sent', new Date());
    const stats = db.getStats();
    expect(stats.totalDrafts).toBe(1);
    expect(stats.totalSent).toBe(1);
  });

  test('logs correspondence and tracks today', () => {
    const logId = db.logCorrespondence({
      contactName: 'Leon Davoyan',
      contactEmail: 'leon@dhc.com',
      channel: 'gmail',
      subject: 'Partnership follow-up',
      summary: 'Sent follow-up about Q2 proposal',
    });

    expect(logId).toBeDefined();

    const todayLog = db.getTodayLog();
    expect(todayLog).toHaveLength(1);
    expect(todayLog[0].contact_name).toBe('Leon Davoyan');

    const responded = db.getRespondedToday();
    expect(responded).toContain('leon@dhc.com');
  });

  test('getStats returns correct counts', () => {
    db.saveQueue(createTestQueue());
    db.logCorrespondence({ contactName: 'Test', channel: 'gmail', subject: 'Test' });

    const stats = db.getStats();
    expect(stats.totalQueues).toBe(1);
    expect(stats.totalItems).toBe(2);
    expect(stats.todaySent).toBe(1);
  });
});

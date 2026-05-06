import { describe, test, expect } from 'bun:test';
import app from './server.js';

describe('Web Dashboard API', () => {
  test('GET /api/health returns status ok', async () => {
    const res = await app.fetch(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.app).toBe('CorrespondOS');
  });

  test('GET /api/queue returns scored items in buckets', async () => {
    const res = await app.fetch(new Request('http://localhost/api/queue'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(data.summary.totalIngested).toBeGreaterThan(0);
    expect(data.items.today).toBeInstanceOf(Array);
    expect(data.items.tomorrow).toBeInstanceOf(Array);
    expect(data.items.thisWeek).toBeInstanceOf(Array);
  });

  test('GET /api/queue/:id returns item detail', async () => {
    // First get the queue to find an item ID
    const queueRes = await app.fetch(new Request('http://localhost/api/queue'));
    const queueData = await queueRes.json();
    const allItems = [...queueData.items.today, ...queueData.items.tomorrow, ...queueData.items.thisWeek];
    
    if (allItems.length > 0) {
      const itemId = allItems[0].id;
      const res = await app.fetch(new Request(`http://localhost/api/queue/${itemId}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(itemId);
      expect(data.item.score).toBeDefined();
      expect(data.item.scoreBreakdown).toBeDefined();
    }
  });

  test('GET /api/queue/:id returns 404 for unknown ID', async () => {
    const res = await app.fetch(new Request('http://localhost/api/queue/nonexistent-id'));
    expect(res.status).toBe(404);
  });

  test('POST /api/queue/:id/draft creates a draft', async () => {
    const queueRes = await app.fetch(new Request('http://localhost/api/queue'));
    const queueData = await queueRes.json();
    const allItems = [...queueData.items.today, ...queueData.items.tomorrow, ...queueData.items.thisWeek];
    
    if (allItems.length > 0) {
      const itemId = allItems[0].id;
      const res = await app.fetch(new Request(`http://localhost/api/queue/${itemId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Test reply', body: 'Hello, this is a test.', tone: 'professional' }),
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.saved).toBe(true);
      expect(data.draftId).toBeDefined();
    }
  });

  test('POST /api/queue/:id/action skips an item', async () => {
    const queueRes = await app.fetch(new Request('http://localhost/api/queue'));
    const queueData = await queueRes.json();
    const allItems = [...queueData.items.today, ...queueData.items.tomorrow, ...queueData.items.thisWeek];
    
    if (allItems.length > 1) {
      const itemId = allItems[allItems.length - 1].id;
      const res = await app.fetch(new Request(`http://localhost/api/queue/${itemId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.newStatus).toBe('skipped');
    }
  });

  test('POST /api/queue/:id/action snoozes an item', async () => {
    const queueRes = await app.fetch(new Request('http://localhost/api/queue'));
    const queueData = await queueRes.json();
    const allItems = [...queueData.items.today, ...queueData.items.tomorrow, ...queueData.items.thisWeek];
    
    if (allItems.length > 0) {
      const itemId = allItems[0].id;
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const res = await app.fetch(new Request(`http://localhost/api/queue/${itemId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snooze', snoozeUntil: tomorrow }),
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.newStatus).toBe('snoozed');
    }
  });

  test('GET /api/adapters returns adapter list', async () => {
    const res = await app.fetch(new Request('http://localhost/api/adapters'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.adapters.length).toBeGreaterThan(0);
    expect(data.adapters.find((a: any) => a.name === 'gmail')).toBeDefined();
    expect(data.adapters.find((a: any) => a.name === 'outlook')).toBeDefined();
  });

  test('POST /api/adapters/:name/reconnect triggers health check', async () => {
    const res = await app.fetch(new Request('http://localhost/api/adapters/hubspot/reconnect', { method: 'POST' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.adapter).toBe('hubspot');
    expect(data.newStatus).toBeDefined();
  });

  test('GET /api/activity returns event log', async () => {
    const res = await app.fetch(new Request('http://localhost/api/activity'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events).toBeInstanceOf(Array);
    expect(data.events.length).toBeGreaterThan(0);
  });

  test('GET /api/stats returns queue statistics', async () => {
    const res = await app.fetch(new Request('http://localhost/api/stats'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBeDefined();
    expect(typeof data.total).toBe('number');
  });

  test('GET / returns HTML dashboard with Anuba design system', async () => {
    const res = await app.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('CorrespondOS');
    expect(html).toContain('Inter');
    expect(html).toContain('/api/queue');
    expect(html).toContain('THEMES');
  });
});

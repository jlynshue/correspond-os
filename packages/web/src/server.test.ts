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

  test('GET /api/queue/today returns only today items', async () => {
    const res = await app.fetch(new Request('http://localhost/api/queue/today'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bucket).toBe('today');
    expect(data.items.every((i: any) => i.score >= 0.7)).toBe(true);
  });

  test('GET /api/adapters returns adapter list', async () => {
    const res = await app.fetch(new Request('http://localhost/api/adapters'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.adapters.length).toBeGreaterThan(0);
    expect(data.adapters.find((a: any) => a.name === 'gmail')).toBeDefined();
    expect(data.adapters.find((a: any) => a.name === 'outlook')).toBeDefined();
  });

  test('GET / returns HTML dashboard', async () => {
    const res = await app.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('CorrespondOS');
    expect(html).toContain('tailwindcss');
    expect(html).toContain('/api/queue');
  });
});

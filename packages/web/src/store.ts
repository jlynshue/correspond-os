import { Database } from 'bun:sqlite';
import { generateId } from '@correspond-os/shared';
import type { ScoredItem, DraftResponse, Channel } from '@correspond-os/shared';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

// ─── Database Setup ─────────────────────────────────────────────────────────

const DATA_DIR = resolve(homedir(), '.correspond-os');
const DB_PATH = resolve(DATA_DIR, 'data.db');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    ensureDataDir();
    _db = new Database(DB_PATH, { create: true });
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ─── Migrations ─────────────────────────────────────────────────────────────

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_ingested INTEGER NOT NULL,
      after_dedup INTEGER NOT NULL,
      channel_status TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS scored_items (
      id TEXT PRIMARY KEY,
      queue_run_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_message_id TEXT,
      contact_name TEXT NOT NULL,
      contact_email TEXT,
      company TEXT,
      subject TEXT NOT NULL,
      body_snippet TEXT,
      timestamp TEXT NOT NULL,
      channel TEXT NOT NULL,
      hubspot_deal_id TEXT,
      urgency_signals TEXT NOT NULL DEFAULT '[]',
      relationship_tier TEXT NOT NULL DEFAULT 'unknown',
      metadata TEXT NOT NULL DEFAULT '{}',
      score REAL NOT NULL,
      bucket TEXT NOT NULL,
      score_revenue REAL NOT NULL DEFAULT 0,
      score_time REAL NOT NULL DEFAULT 0,
      score_relationship REAL NOT NULL DEFAULT 0,
      score_channel REAL NOT NULL DEFAULT 0,
      merged_from TEXT DEFAULT '[]',
      sync_mismatch INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unread',
      snoozed_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (queue_run_id) REFERENCES queue_runs(id)
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      channel TEXT NOT NULL,
      template_used TEXT,
      tone TEXT NOT NULL DEFAULT 'professional',
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      FOREIGN KEY (item_id) REFERENCES scored_items(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      item_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_bucket ON scored_items(bucket);
    CREATE INDEX IF NOT EXISTS idx_items_status ON scored_items(status);
    CREATE INDEX IF NOT EXISTS idx_items_score ON scored_items(score DESC);
    CREATE INDEX IF NOT EXISTS idx_items_contact ON scored_items(contact_email);
    CREATE INDEX IF NOT EXISTS idx_items_run ON scored_items(queue_run_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_item ON drafts(item_id);
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(type);
    CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(timestamp DESC);
  `);
}

// ─── Queue Run Operations ───────────────────────────────────────────────────

export function saveQueueRun(totalIngested: number, afterDedup: number, channelStatus: Record<string, string>): string {
  const db = getDb();
  const id = generateId();
  db.prepare('INSERT INTO queue_runs (id, total_ingested, after_dedup, channel_status) VALUES (?, ?, ?, ?)').run(
    id, totalIngested, afterDedup, JSON.stringify(channelStatus)
  );
  return id;
}

export function getLatestQueueRun(): { id: string; created_at: string; total_ingested: number; after_dedup: number } | null {
  const db = getDb();
  return db.prepare('SELECT * FROM queue_runs ORDER BY created_at DESC LIMIT 1').get() as any;
}

// ─── Scored Item Operations ─────────────────────────────────────────────────

export function saveScoreItems(queueRunId: string, items: ScoredItem[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO scored_items 
    (id, queue_run_id, source, source_message_id, contact_name, contact_email, company, subject, body_snippet, timestamp, channel, hubspot_deal_id, urgency_signals, relationship_tier, metadata, score, bucket, score_revenue, score_time, score_relationship, score_channel, merged_from, sync_mismatch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items: ScoredItem[]) => {
    for (const item of items) {
      stmt.run(
        item.id,
        queueRunId,
        item.source,
        (item as any).sourceMessageId ?? null,
        item.contactName,
        item.contactEmail ?? null,
        item.company ?? null,
        item.subject,
        item.bodySnippet ?? null,
        item.timestamp.toISOString(),
        item.channel,
        item.hubspotDealId ?? null,
        JSON.stringify(item.urgencySignals),
        item.relationshipTier,
        JSON.stringify(item.metadata),
        item.score,
        item.bucket,
        item.scoreBreakdown.revenueImpact,
        item.scoreBreakdown.timeSensitivity,
        item.scoreBreakdown.relationshipTier,
        item.scoreBreakdown.channelUrgency,
        JSON.stringify(item.mergedFrom),
        item.syncMismatch ? 1 : 0,
      );
    }
  });

  transaction(items);
}

export function getItemsByBucket(bucket: string, excludeStatuses: string[] = ['skipped']): ScoredItem[] {
  const db = getDb();
  const placeholders = excludeStatuses.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM scored_items WHERE bucket = ? AND status NOT IN (${placeholders}) ORDER BY score DESC`
  ).all(bucket, ...excludeStatuses) as any[];

  return rows.map(rowToScoredItem);
}

export function getItemById(id: string): ScoredItem | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scored_items WHERE id = ?').get(id) as any;
  return row ? rowToScoredItem(row) : null;
}

export function updateItemStatus(id: string, status: string, snoozedUntil?: string) {
  const db = getDb();
  if (snoozedUntil) {
    db.prepare('UPDATE scored_items SET status = ?, snoozed_until = ? WHERE id = ?').run(status, snoozedUntil, id);
  } else {
    db.prepare('UPDATE scored_items SET status = ? WHERE id = ?').run(status, id);
  }
}

export function getSnoozedItemsDueNow(): ScoredItem[] {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db.prepare(
    "SELECT * FROM scored_items WHERE status = 'snoozed' AND snoozed_until <= ? ORDER BY score DESC"
  ).all(now) as any[];
  return rows.map(rowToScoredItem);
}

export function getItemsRespondedToday(): string[] {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(
    "SELECT contact_email FROM scored_items WHERE status IN ('sent', 'drafted') AND created_at >= ?"
  ).all(today + 'T00:00:00') as any[];
  return rows.map(r => r.contact_email).filter(Boolean);
}

// ─── Draft Operations ───────────────────────────────────────────────────────

export function saveDraft(itemId: string, draft: Omit<DraftResponse, 'itemId' | 'createdAt' | 'status'>): string {
  const db = getDb();
  const id = generateId();
  db.prepare(
    'INSERT INTO drafts (id, item_id, subject, body, channel, template_used, tone) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, itemId, draft.subject, draft.body, draft.channel, draft.templateUsed ?? null, draft.tone);
  
  // Also update the item status
  updateItemStatus(itemId, 'drafted');
  
  return id;
}

export function getDraftsByItemId(itemId: string): any[] {
  const db = getDb();
  return db.prepare('SELECT * FROM drafts WHERE item_id = ? ORDER BY created_at DESC').all(itemId) as any[];
}

export function updateDraftStatus(draftId: string, status: string, sentAt?: string) {
  const db = getDb();
  if (sentAt) {
    db.prepare('UPDATE drafts SET status = ?, sent_at = ? WHERE id = ?').run(status, sentAt, draftId);
  } else {
    db.prepare('UPDATE drafts SET status = ? WHERE id = ?').run(status, draftId);
  }
}

// ─── Activity Log ───────────────────────────────────────────────────────────

export function logActivity(type: string, action: string, detail?: string, itemId?: string) {
  const db = getDb();
  db.prepare('INSERT INTO activity_log (type, action, detail, item_id) VALUES (?, ?, ?, ?)').run(
    type, action, detail ?? null, itemId ?? null
  );
}

export function getActivityLog(limit = 50, type?: string): any[] {
  const db = getDb();
  if (type) {
    return db.prepare('SELECT * FROM activity_log WHERE type = ? ORDER BY timestamp DESC LIMIT ?').all(type, limit) as any[];
  }
  return db.prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function getQueueStats(): { total: number; unread: number; viewed: number; drafted: number; sent: number; skipped: number; snoozed: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) as viewed,
      SUM(CASE WHEN status = 'drafted' THEN 1 ELSE 0 END) as drafted,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status = 'snoozed' THEN 1 ELSE 0 END) as snoozed
    FROM scored_items
  `).get() as any;
  return row;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rowToScoredItem(row: any): ScoredItem {
  return {
    id: row.id,
    source: row.source,
    sourceMessageId: row.source_message_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    company: row.company,
    subject: row.subject,
    bodySnippet: row.body_snippet,
    timestamp: new Date(row.timestamp),
    channel: row.channel as Channel,
    hubspotDealId: row.hubspot_deal_id,
    urgencySignals: JSON.parse(row.urgency_signals || '[]'),
    relationshipTier: row.relationship_tier,
    metadata: JSON.parse(row.metadata || '{}'),
    score: row.score,
    bucket: row.bucket,
    scoreBreakdown: {
      revenueImpact: row.score_revenue,
      timeSensitivity: row.score_time,
      relationshipTier: row.score_relationship,
      channelUrgency: row.score_channel,
    },
    mergedFrom: JSON.parse(row.merged_from || '[]'),
    syncMismatch: Boolean(row.sync_mismatch),
  };
}

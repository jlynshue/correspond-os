import { Database as BunDB } from 'bun:sqlite';
import type { NormalizedMessage, ScoredItem, DraftResponse, CorrespondenceQueue } from '@correspond-os/shared';
import { generateId, toDateString } from '@correspond-os/shared';

export interface DatabaseOptions {
  /** Path to SQLite file (default: ~/.correspond-os/data.db) */
  path?: string;
  /** Create tables on init (default: true) */
  migrate?: boolean;
}

/**
 * SQLite persistence layer for CorrespondOS.
 *
 * Stores:
 * - Correspondence queues (daily snapshots)
 * - Scored items with full metadata
 * - Draft responses and their send status
 * - Correspondence log (sent items)
 */
export class Database {
  private db: BunDB;

  constructor(options: DatabaseOptions = {}) {
    const path = options.path ?? ':memory:';
    this.db = new BunDB(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    if (options.migrate !== false) {
      this.migrate();
    }
  }

  /** Run migrations to create/update schema */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queues (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        total_ingested INTEGER NOT NULL DEFAULT 0,
        after_dedup INTEGER NOT NULL DEFAULT 0,
        sync_mismatches INTEGER NOT NULL DEFAULT 0,
        channel_status TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        queue_id TEXT NOT NULL,
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
        score REAL NOT NULL DEFAULT 0,
        bucket TEXT NOT NULL DEFAULT 'this-week',
        score_breakdown TEXT NOT NULL DEFAULT '{}',
        merged_from TEXT NOT NULL DEFAULT '[]',
        sync_mismatch INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (queue_id) REFERENCES queues(id)
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        queue_id TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        channel TEXT NOT NULL,
        template_used TEXT,
        tone TEXT NOT NULL DEFAULT 'professional',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        sent_at TEXT,
        FOREIGN KEY (item_id) REFERENCES items(id)
      );

      CREATE TABLE IF NOT EXISTS correspondence_log (
        id TEXT PRIMARY KEY,
        contact_name TEXT NOT NULL,
        contact_email TEXT,
        channel TEXT NOT NULL,
        subject TEXT NOT NULL,
        summary TEXT,
        sent_at TEXT NOT NULL,
        item_id TEXT,
        draft_id TEXT,
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_items_queue ON items(queue_id);
      CREATE INDEX IF NOT EXISTS idx_items_score ON items(score DESC);
      CREATE INDEX IF NOT EXISTS idx_items_bucket ON items(bucket);
      CREATE INDEX IF NOT EXISTS idx_items_contact ON items(contact_email);
      CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
      CREATE INDEX IF NOT EXISTS idx_log_sent ON correspondence_log(sent_at);
    `);
  }

  /** Save a complete correspondence queue */
  saveQueue(queue: CorrespondenceQueue): void {
    const insertQueue = this.db.prepare(`
      INSERT OR REPLACE INTO queues (id, created_at, total_ingested, after_dedup, sync_mismatches, channel_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertItem = this.db.prepare(`
      INSERT OR REPLACE INTO items (id, queue_id, source, source_message_id, contact_name, contact_email, company, subject, body_snippet, timestamp, channel, hubspot_deal_id, urgency_signals, relationship_tier, metadata, score, bucket, score_breakdown, merged_from, sync_mismatch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertQueue.run(
        queue.id,
        queue.createdAt.toISOString(),
        queue.totalIngested,
        queue.afterDedup,
        queue.syncMismatches,
        JSON.stringify(queue.channelStatus),
      );

      for (const item of queue.items) {
        insertItem.run(
          item.id,
          queue.id,
          item.source,
          item.sourceMessageId ?? null,
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
          JSON.stringify(item.scoreBreakdown),
          JSON.stringify(item.mergedFrom),
          item.syncMismatch ? 1 : 0,
        );
      }
    });

    transaction();
  }

  /** Get the most recent queue */
  getLatestQueue(): { id: string; createdAt: string; totalIngested: number; afterDedup: number } | null {
    return this.db.prepare(`
      SELECT id, created_at as createdAt, total_ingested as totalIngested, after_dedup as afterDedup
      FROM queues ORDER BY created_at DESC LIMIT 1
    `).get() as any;
  }

  /** Get items for a specific queue, optionally filtered by bucket */
  getItems(queueId: string, bucket?: string): any[] {
    if (bucket) {
      return this.db.prepare(`
        SELECT * FROM items WHERE queue_id = ? AND bucket = ? ORDER BY score DESC
      `).all(queueId, bucket) as any[];
    }
    return this.db.prepare(`
      SELECT * FROM items WHERE queue_id = ? ORDER BY score DESC
    `).all(queueId) as any[];
  }

  /** Save a draft response */
  saveDraft(draft: DraftResponse & { queueId?: string }): string {
    const id = generateId();
    this.db.prepare(`
      INSERT INTO drafts (id, item_id, queue_id, subject, body, channel, template_used, tone, status, created_at, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      draft.itemId,
      draft.queueId ?? null,
      draft.subject,
      draft.body,
      draft.channel,
      draft.templateUsed ?? null,
      draft.tone,
      draft.status,
      draft.createdAt.toISOString(),
      draft.sentAt?.toISOString() ?? null,
    );
    return id;
  }

  /** Update draft status (e.g., draft → approved → sent) */
  updateDraftStatus(draftId: string, status: string, sentAt?: Date): void {
    this.db.prepare(`
      UPDATE drafts SET status = ?, sent_at = ? WHERE id = ?
    `).run(status, sentAt?.toISOString() ?? null, draftId);
  }

  /** Log a sent correspondence */
  logCorrespondence(entry: {
    contactName: string;
    contactEmail?: string;
    channel: string;
    subject: string;
    summary?: string;
    itemId?: string;
    draftId?: string;
  }): string {
    const id = generateId();
    this.db.prepare(`
      INSERT INTO correspondence_log (id, contact_name, contact_email, channel, subject, summary, sent_at, item_id, draft_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.contactName,
      entry.contactEmail ?? null,
      entry.channel,
      entry.subject,
      entry.summary ?? null,
      new Date().toISOString(),
      entry.itemId ?? null,
      entry.draftId ?? null,
    );
    return id;
  }

  /** Get today's correspondence log */
  getTodayLog(): any[] {
    const today = toDateString(new Date());
    return this.db.prepare(`
      SELECT * FROM correspondence_log WHERE sent_at >= ? ORDER BY sent_at DESC
    `).all(`${today}T00:00:00`) as any[];
  }

  /** Get contacts already responded to today (for --refresh mode) */
  getRespondedToday(): string[] {
    const today = toDateString(new Date());
    const rows = this.db.prepare(`
      SELECT DISTINCT contact_email FROM correspondence_log WHERE sent_at >= ? AND contact_email IS NOT NULL
    `).all(`${today}T00:00:00`) as any[];
    return rows.map((r: any) => r.contact_email);
  }

  /** Get stats for dashboard */
  getStats(): {
    totalQueues: number;
    totalItems: number;
    totalDrafts: number;
    totalSent: number;
    todayItems: number;
    todaySent: number;
  } {
    const today = toDateString(new Date());
    return {
      totalQueues: (this.db.prepare('SELECT COUNT(*) as c FROM queues').get() as any).c,
      totalItems: (this.db.prepare('SELECT COUNT(*) as c FROM items').get() as any).c,
      totalDrafts: (this.db.prepare('SELECT COUNT(*) as c FROM drafts').get() as any).c,
      totalSent: (this.db.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'sent'").get() as any).c,
      todayItems: (this.db.prepare(`SELECT COUNT(*) as c FROM items WHERE timestamp >= '${today}T00:00:00'`).get() as any).c,
      todaySent: (this.db.prepare(`SELECT COUNT(*) as c FROM correspondence_log WHERE sent_at >= '${today}T00:00:00'`).get() as any).c,
    };
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}

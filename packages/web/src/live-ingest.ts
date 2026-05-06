import { ScoreEngine, Normalizer, Deduplicator } from '@correspond-os/core';
import { GmailAdapter } from '@correspond-os/adapters';
import { OutlookAdapter } from '@correspond-os/adapters';
import type { NormalizedMessage, ScoredItem, Channel } from '@correspond-os/shared';
import { generateId } from '@correspond-os/shared';

// ─── MCP Client Shim ────────────────────────────────────────────────────────
// In production, this would connect to running MCP servers.
// For now, we provide a shim that the adapters use.

interface McpClientShim {
  call(server: string, tool: string, params: Record<string, unknown>): Promise<unknown>;
}

// This will be replaced with real MCP connections when running inside Goose
let mcpClient: McpClientShim | null = null;

export function setMcpClient(client: McpClientShim) {
  mcpClient = client;
}

// ─── Adapter Registry ────────────────────────────────────────────────────────

interface AdapterEntry {
  name: Channel;
  displayName: string;
  adapter: { healthCheck: () => Promise<any>; ingest: (opts?: any) => Promise<NormalizedMessage[]> };
  config: Record<string, unknown>;
}

function getRegisteredAdapters(): AdapterEntry[] {
  const adapters: AdapterEntry[] = [];

  // Gmail adapter (4 accounts)
  if (mcpClient) {
    adapters.push({
      name: 'gmail',
      displayName: 'Gmail',
      adapter: new GmailAdapter({
        accounts: [
          'jonathan.lynshue@gmail.com',
          'jlynshue@gmail.com',
          'themightystandard@gmail.com',
          'jonathan@denmother.com',
        ],
        mcpServer: 'google-workspace',
        defaultMaxResults: 25,
      }, mcpClient),
      config: { accounts: 4 },
    });

    // Outlook adapter
    adapters.push({
      name: 'outlook',
      displayName: 'Outlook',
      adapter: new OutlookAdapter({
        mcpServer: 'lokka-microsoft-anuba',
        defaultMaxResults: 25,
        userEmail: 'jonathan.lynshue@anubatechnologies.com',
      }, mcpClient),
      config: { accounts: 1 },
    });
  }

  return adapters;
}

// ─── Live Ingestion Pipeline ─────────────────────────────────────────────────

export interface IngestResult {
  items: {
    today: ScoredItem[];
    tomorrow: ScoredItem[];
    thisWeek: ScoredItem[];
  };
  summary: {
    totalIngested: number;
    afterDedup: number;
    today: number;
    tomorrow: number;
    thisWeek: number;
    generatedAt: string;
  };
  adapterStatus: Array<{
    name: string;
    displayName: string;
    status: 'healthy' | 'degraded' | 'unavailable' | 'idle';
    lastIngest: string;
    messages: number;
    latencyMs?: number;
    note?: string;
  }>;
}

export async function runLiveIngest(options?: { since?: Date; maxPerAdapter?: number }): Promise<IngestResult> {
  const adapters = getRegisteredAdapters();
  const allMessages: NormalizedMessage[] = [];
  const adapterStatus: IngestResult['adapterStatus'] = [];
  const since = options?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // default: last 24h
  const maxPerAdapter = options?.maxPerAdapter ?? 25;

  // Ingest from each adapter (parallel)
  const ingestPromises = adapters.map(async (entry) => {
    const start = Date.now();
    try {
      const health = await entry.adapter.healthCheck();
      if (health.status === 'unavailable') {
        adapterStatus.push({
          name: entry.name,
          displayName: entry.displayName,
          status: 'unavailable',
          lastIngest: 'never',
          messages: 0,
          note: health.message,
        });
        return [];
      }

      const messages = await entry.adapter.ingest({ since, maxResults: maxPerAdapter });
      const latencyMs = Date.now() - start;

      adapterStatus.push({
        name: entry.name,
        displayName: entry.displayName,
        status: health.status as any,
        lastIngest: 'just now',
        messages: messages.length,
        latencyMs,
      });

      return messages;
    } catch (err) {
      adapterStatus.push({
        name: entry.name,
        displayName: entry.displayName,
        status: 'unavailable',
        lastIngest: 'failed',
        messages: 0,
        note: err instanceof Error ? err.message : 'Unknown error',
      });
      return [];
    }
  });

  const results = await Promise.all(ingestPromises);
  for (const msgs of results) {
    allMessages.push(...msgs);
  }

  // Add static adapters that aren't connected yet
  const connectedNames = new Set(adapters.map(a => a.name));
  const staticAdapters: Array<{ name: Channel; displayName: string; status: string; note: string }> = [
    { name: 'hubspot', displayName: 'HubSpot', status: 'idle', note: 'Adapter not connected' },
    { name: 'linkedin', displayName: 'LinkedIn', status: 'idle', note: 'Browser-only (manual)' },
    { name: 'confluence', displayName: 'Confluence', status: 'idle', note: 'Adapter not connected' },
    { name: 'slack', displayName: 'Slack', status: 'idle', note: 'Not configured' },
    { name: 'super-productivity', displayName: 'Super Productivity', status: 'idle', note: 'Adapter not connected' },
    { name: 'github', displayName: 'GitHub', status: 'idle', note: 'Adapter not connected' },
  ];

  for (const sa of staticAdapters) {
    if (!connectedNames.has(sa.name)) {
      adapterStatus.push({ ...sa, status: sa.status as any, lastIngest: 'n/a', messages: 0 });
    }
  }

  // Normalize + Dedup + Score
  const normalizer = new Normalizer();
  const dedup = new Deduplicator();
  const engine = new ScoreEngine();

  const { messages: normalized } = normalizer.normalizeBatch(
    allMessages.map(m => ({ ...m, source: m.source as string, subject: m.subject }))
  );
  const deduplicated = dedup.deduplicate(normalized);
  const scored = engine.scoreAll(deduplicated);

  const today = scored.filter(s => s.bucket === 'today');
  const tomorrow = scored.filter(s => s.bucket === 'tomorrow');
  const thisWeek = scored.filter(s => s.bucket === 'this-week');

  return {
    items: { today, tomorrow, thisWeek },
    summary: {
      totalIngested: allMessages.length,
      afterDedup: deduplicated.length,
      today: today.length,
      tomorrow: tomorrow.length,
      thisWeek: thisWeek.length,
      generatedAt: new Date().toISOString(),
    },
    adapterStatus,
  };
}

// ─── Fallback: Demo Data (when no MCP client is available) ───────────────────

export function getDemoIngestResult(): IngestResult {
  const normalizer = new Normalizer();
  const dedup = new Deduplicator();
  const engine = new ScoreEngine();

  const rawItems: Array<Partial<NormalizedMessage> & { source: string; subject: string }> = [
    { source: 'outlook', contactName: 'Robert McDonnell', contactEmail: 'robert@anubatechnologies.com', subject: 'Council of Domain Experts Review', timestamp: new Date(), urgencySignals: ['high-importance'], relationshipTier: 'internal' },
    { source: 'gmail', contactName: 'Leon Davoyan', contactEmail: 'leon@dhc.com', subject: 'Re: Partnership Proposal', timestamp: new Date(Date.now() - 2*86400000), hubspotDealId: 'deal-dhc-001', metadata: { dealStage: 'negotiation' }, urgencySignals: ['stale-deal'], relationshipTier: 'opportunity' },
    { source: 'linkedin', contactName: 'Sarah Chen', subject: 'Interested in Anuba platform', timestamp: new Date(Date.now() - 86400000), urgencySignals: ['unread-dm'], relationshipTier: 'lead' },
    { source: 'github', contactName: 'GitHub Actions', contactEmail: 'noreply@github.com', subject: 'anuba-crm Integration Tests FAILED', timestamp: new Date(), urgencySignals: ['ci-failure'], relationshipTier: 'unknown' },
    { source: 'hubspot', contactName: 'Hamed Farsani', contactEmail: 'hamed@hfblabs.com', subject: 'Follow up on HFBLabs proposal', timestamp: new Date(Date.now() - 4*86400000), hubspotDealId: 'deal-hfb-002', metadata: { dealStage: 'proposal' }, urgencySignals: ['stale-deal'], relationshipTier: 'opportunity' },
    { source: 'confluence', contactName: 'Mithun Konduri', contactEmail: 'mithun@anubatechnologies.com', subject: 'Mentioned you in Sprint Planning', timestamp: new Date(Date.now() - 3*86400000), relationshipTier: 'internal' },
    { source: 'gmail', contactName: 'Taryn Faliszewski', contactEmail: 'taryn@google.com', subject: 'Google Cloud Trial — Personal Tour', timestamp: new Date(Date.now() - 6*86400000), relationshipTier: 'lead' },
    { source: 'outlook', contactName: 'Dave Mathews', contactEmail: 'dave@anubatechnologies.com', subject: 'Re: Anuba Weekly GTM Meeting', timestamp: new Date(Date.now() - 0.5*86400000), relationshipTier: 'internal' },
    { source: 'github', contactName: 'Dependabot', contactEmail: 'noreply@github.com', subject: 'PAT winsurf-anuba expiring in 7 days', timestamp: new Date(), urgencySignals: ['token-expiring'], relationshipTier: 'unknown' },
    { source: 'gmail', contactName: 'OpenAI', contactEmail: 'noreply@openai.com', subject: 'Security update for macOS apps', timestamp: new Date(Date.now() - 86400000), urgencySignals: ['deadline-today'], relationshipTier: 'unknown' },
  ];

  const { messages } = normalizer.normalizeBatch(rawItems);
  const deduplicated = dedup.deduplicate(messages);
  const scored = engine.scoreAll(deduplicated);

  const today = scored.filter(s => s.bucket === 'today');
  const tomorrow = scored.filter(s => s.bucket === 'tomorrow');
  const thisWeek = scored.filter(s => s.bucket === 'this-week');

  return {
    items: { today, tomorrow, thisWeek },
    summary: {
      totalIngested: rawItems.length,
      afterDedup: deduplicated.length,
      today: today.length,
      tomorrow: tomorrow.length,
      thisWeek: thisWeek.length,
      generatedAt: new Date().toISOString(),
    },
    adapterStatus: [
      { name: 'gmail', displayName: 'Gmail', status: 'healthy', lastIngest: 'demo', messages: 3 },
      { name: 'outlook', displayName: 'Outlook', status: 'healthy', lastIngest: 'demo', messages: 2 },
      { name: 'hubspot', displayName: 'HubSpot', status: 'degraded', lastIngest: '15m ago', messages: 1, note: 'Transport timeout' },
      { name: 'linkedin', displayName: 'LinkedIn', status: 'unavailable', lastIngest: 'n/a', messages: 1, note: 'Login required' },
      { name: 'confluence', displayName: 'Confluence', status: 'healthy', lastIngest: 'demo', messages: 1 },
      { name: 'slack', displayName: 'Slack', status: 'idle', lastIngest: 'n/a', messages: 0, note: 'Not configured' },
      { name: 'super-productivity', displayName: 'Super Productivity', status: 'healthy', lastIngest: '1m ago', messages: 0 },
      { name: 'github', displayName: 'GitHub', status: 'healthy', lastIngest: 'demo', messages: 2 },
    ],
  };
}

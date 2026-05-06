import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { ScoreEngine, Normalizer, Deduplicator } from '@correspond-os/core';
import type { NormalizedMessage, ScoredItem } from '@correspond-os/shared';
import { APP } from '@correspond-os/shared';

const app = new Hono();

// Middleware
app.use('*', cors());

// API Routes
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    app: APP.displayName,
    version: APP.version,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/queue', (c) => {
  // In production, this would read from the SQLite persistence layer
  // For now, return demo data scored in real-time
  const engine = new ScoreEngine();
  const normalizer = new Normalizer();
  const dedup = new Deduplicator();

  const rawItems = getDemoMessages();
  const { messages } = normalizer.normalizeBatch(rawItems);
  const deduplicated = dedup.deduplicate(messages);
  const scored = engine.scoreAll(deduplicated);

  const today = scored.filter((s) => s.bucket === 'today');
  const tomorrow = scored.filter((s) => s.bucket === 'tomorrow');
  const thisWeek = scored.filter((s) => s.bucket === 'this-week');

  return c.json({
    summary: {
      totalIngested: rawItems.length,
      afterDedup: deduplicated.length,
      today: today.length,
      tomorrow: tomorrow.length,
      thisWeek: thisWeek.length,
      generatedAt: new Date().toISOString(),
    },
    items: { today, tomorrow, thisWeek },
  });
});

app.get('/api/queue/:bucket', (c) => {
  const bucket = c.req.param('bucket');
  const engine = new ScoreEngine();
  const normalizer = new Normalizer();
  const dedup = new Deduplicator();

  const rawItems = getDemoMessages();
  const { messages } = normalizer.normalizeBatch(rawItems);
  const deduplicated = dedup.deduplicate(messages);
  const scored = engine.scoreAll(deduplicated);

  const filtered = scored.filter((s) => s.bucket === bucket);
  return c.json({ bucket, count: filtered.length, items: filtered });
});

app.get('/api/adapters', (c) => {
  return c.json({
    adapters: [
      { name: 'gmail', displayName: 'Gmail', status: 'configured', accounts: 4 },
      { name: 'outlook', displayName: 'Outlook', status: 'configured', accounts: 1 },
      { name: 'hubspot', displayName: 'HubSpot', status: 'configured' },
      { name: 'linkedin', displayName: 'LinkedIn', status: 'browser-only' },
      { name: 'confluence', displayName: 'Confluence', status: 'configured' },
      { name: 'slack', displayName: 'Slack', status: 'not-configured' },
    ],
  });
});

// Serve static files (built React app)
app.use('/static/*', serveStatic({ root: './dist/client' }));

// SPA fallback — serve index.html for all non-API routes
app.get('/', (c) => {
  return c.html(getIndexHtml());
});

// Demo data
function getDemoMessages(): Array<Partial<NormalizedMessage> & { source: string; subject: string }> {
  return [
    {
      source: 'outlook',
      contactName: 'Robert McDonnell',
      contactEmail: 'robert@anubatechnologies.com',
      subject: 'Council of Domain Experts Review',
      timestamp: new Date(),
      urgencySignals: ['high-importance'],
      relationshipTier: 'internal',
    },
    {
      source: 'gmail',
      contactName: 'Leon Davoyan',
      contactEmail: 'leon@dhc.com',
      subject: 'Re: Partnership Proposal',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      hubspotDealId: 'deal-dhc-001',
      metadata: { dealStage: 'negotiation' },
      urgencySignals: ['stale-deal'],
      relationshipTier: 'opportunity',
    },
    {
      source: 'linkedin',
      contactName: 'Sarah Chen',
      subject: 'Interested in Anuba platform',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      urgencySignals: ['unread-dm'],
      relationshipTier: 'lead',
    },
    {
      source: 'github',
      contactName: 'GitHub Actions',
      contactEmail: 'noreply@github.com',
      subject: 'anuba-crm Integration Tests FAILED',
      timestamp: new Date(),
      urgencySignals: ['ci-failure'],
      relationshipTier: 'unknown',
    },
    {
      source: 'hubspot',
      contactName: 'Hamed Farsani',
      contactEmail: 'hamed@hfblabs.com',
      subject: 'Follow up on HFBLabs proposal',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      hubspotDealId: 'deal-hfb-002',
      metadata: { dealStage: 'proposal' },
      urgencySignals: ['stale-deal'],
      relationshipTier: 'opportunity',
    },
    {
      source: 'confluence',
      contactName: 'Mithun Konduri',
      contactEmail: 'mithun@anubatechnologies.com',
      subject: 'Mentioned you in Sprint Planning',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      relationshipTier: 'internal',
    },
  ];
}

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CorrespondOS — Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { colors: { brand: { 50: '#f0f9ff', 500: '#0ea5e9', 900: '#0c4a6e' } } } }
    }
  </script>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
    .score-bar { transition: width 0.3s ease; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="root"></div>
  <script type="module">
    // Lightweight vanilla JS dashboard (no React build step needed for v0.1)
    async function loadQueue() {
      const res = await fetch('/api/queue');
      const data = await res.json();
      renderDashboard(data);
    }

    function renderDashboard(data) {
      const root = document.getElementById('root');
      root.innerHTML = \`
        <div class="max-w-6xl mx-auto px-6 py-8">
          <header class="mb-8">
            <h1 class="text-3xl font-bold text-white">📬 CorrespondOS</h1>
            <p class="text-gray-400 mt-1">Multi-channel correspondence triage</p>
          </header>

          <!-- Summary Cards -->
          <div class="grid grid-cols-4 gap-4 mb-8">
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div class="text-sm text-gray-400">Ingested</div>
              <div class="text-2xl font-bold text-white">\${data.summary.totalIngested}</div>
            </div>
            <div class="bg-red-950/50 rounded-xl p-4 border border-red-800/50">
              <div class="text-sm text-red-400">Today</div>
              <div class="text-2xl font-bold text-red-300">\${data.summary.today}</div>
            </div>
            <div class="bg-yellow-950/50 rounded-xl p-4 border border-yellow-800/50">
              <div class="text-sm text-yellow-400">Tomorrow</div>
              <div class="text-2xl font-bold text-yellow-300">\${data.summary.tomorrow}</div>
            </div>
            <div class="bg-blue-950/50 rounded-xl p-4 border border-blue-800/50">
              <div class="text-sm text-blue-400">This Week</div>
              <div class="text-2xl font-bold text-blue-300">\${data.summary.thisWeek}</div>
            </div>
          </div>

          <!-- Queue Sections -->
          \${renderBucket('🔴 Today', data.items.today, 'red')}
          \${renderBucket('🟡 Tomorrow', data.items.tomorrow, 'yellow')}
          \${renderBucket('🔵 This Week', data.items.thisWeek, 'blue')}

          <footer class="mt-12 text-center text-gray-600 text-sm">
            Generated at \${new Date(data.summary.generatedAt).toLocaleString()}
          </footer>
        </div>
      \`;
    }

    function renderBucket(title, items, color) {
      if (!items || items.length === 0) return '';
      return \`
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-\${color}-400 mb-3">\${title}</h2>
          <div class="space-y-2">
            \${items.map(item => renderItem(item, color)).join('')}
          </div>
        </div>
      \`;
    }

    function renderItem(item, color) {
      const scorePercent = Math.round(item.score * 100);
      const channelIcons = { gmail: '📧', outlook: '📨', linkedin: '💬', hubspot: '💼', confluence: '🏢', github: '🐙', slack: '💬' };
      const icon = channelIcons[item.channel] || '📋';
      return \`
        <div class="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-lg">\${icon}</span>
              <div>
                <div class="font-medium text-white">\${item.contactName}</div>
                <div class="text-sm text-gray-400">\${item.subject}</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="text-xs text-gray-500">\${item.channel}</div>
                <div class="text-sm font-mono text-\${color}-400">\${item.score.toFixed(2)}</div>
              </div>
              <div class="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div class="score-bar h-full bg-\${color}-500 rounded-full" style="width: \${scorePercent}%"></div>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    loadQueue();
    // Auto-refresh every 60s
    setInterval(loadQueue, 60000);
  </script>
</body>
</html>`;
}

// Start server
const port = parseInt(process.env.PORT ?? '3000');
console.log(`🚀 CorrespondOS Dashboard running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};

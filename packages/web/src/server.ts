import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ScoreEngine, Normalizer, Deduplicator } from '@correspond-os/core';
import type { NormalizedMessage } from '@correspond-os/shared';
import { APP } from '@correspond-os/shared';

const app = new Hono();
app.use('*', cors());

// ─── API Routes ─────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', app: APP.displayName, version: APP.version, timestamp: new Date().toISOString() }));

app.get('/api/queue', (c) => {
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
    summary: { totalIngested: rawItems.length, afterDedup: deduplicated.length, today: today.length, tomorrow: tomorrow.length, thisWeek: thisWeek.length, generatedAt: new Date().toISOString() },
    items: { today, tomorrow, thisWeek },
  });
});

app.get('/api/adapters', (c) => c.json({
  adapters: [
    { name: 'gmail', displayName: 'Gmail', status: 'healthy', accounts: 4, lastIngest: '2m ago', messages: 85 },
    { name: 'outlook', displayName: 'Outlook', status: 'healthy', accounts: 1, lastIngest: '3m ago', messages: 12 },
    { name: 'hubspot', displayName: 'HubSpot', status: 'degraded', deals: 82, lastIngest: '15m ago', messages: 8 },
    { name: 'linkedin', displayName: 'LinkedIn', status: 'unavailable', note: 'Login required' },
    { name: 'confluence', displayName: 'Confluence', status: 'healthy', lastIngest: '5m ago', messages: 3 },
    { name: 'slack', displayName: 'Slack', status: 'idle', note: 'Not configured' },
    { name: 'super-productivity', displayName: 'Super Productivity', status: 'healthy', tasks: 0, lastIngest: '1m ago' },
    { name: 'github', displayName: 'GitHub', status: 'healthy', prs: 2, lastIngest: '10m ago' },
  ],
}));

app.get('/api/activity', (c) => c.json({
  events: [
    { time: '14:22', action: 'Scored 38 messages', detail: 'Today: 3, Tomorrow: 5, This Week: 2', type: 'score' },
    { time: '14:20', action: 'Ingested from Outlook', detail: '12 unread messages', type: 'ingest' },
    { time: '14:20', action: 'Ingested from Gmail (4 accounts)', detail: '26 unread messages', type: 'ingest' },
    { time: '14:19', action: 'HubSpot degraded', detail: 'Transport timeout — retry in 60s', type: 'warn' },
    { time: '14:18', action: 'Deduplicated queue', detail: '38 → 10 unique items', type: 'dedup' },
    { time: '14:15', action: 'Session started', detail: 'All adapters initialized', type: 'system' },
    { time: '13:45', action: 'Draft sent: Robert McDonnell', detail: 'Re: Council of Domain Experts', type: 'send' },
    { time: '13:30', action: 'AT-261 updated in Jira', detail: 'Assigned to Jon, In Progress', type: 'action' },
  ],
}));

app.get('/', (c) => c.html(getIndexHtml()));

// ─── Demo Data ──────────────────────────────────────────────────────────────

function getDemoMessages(): Array<Partial<NormalizedMessage> & { source: string; subject: string }> {
  return [
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
}

// ─── Dashboard HTML ─────────────────────────────────────────────────────────

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CorrespondOS — Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  html, body, #root { height: 100%; margin: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; font-feature-settings: "cv11", "ss01"; }
  *, *::before, *::after { box-sizing: border-box; }
  button { font-family: inherit; cursor: pointer; }
  @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.3s ease; }
</style>
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone@7.26.0/babel.min.js" crossorigin></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

// ═══════════════════════════════════════════════════════════════════════════════
// THEME (repurposed from Anuba Design System — coral palette)
// ═══════════════════════════════════════════════════════════════════════════════

const THEMES = {
  coral: {
    bg: '#F4F4F5', surface: '#FFFFFF', sidebar: '#F8F9FA',
    text: '#111114', textMuted: '#6B7280', textSubtle: '#9CA3AF',
    border: '#E5E7EB', borderStrong: '#D1D5DB',
    primary: '#E84B26', primarySoft: '#EB8B70', primaryWash: '#FEF2EE',
    success: '#16A34A', warn: '#D97706', crit: '#DC2626', info: '#2563EB',
    chart1: '#E84B26', chart2: '#EB8B70', chart3: '#FBBF77', chart4: '#7CC4B5', chart5: '#5B7CB8',
  },
  dark: {
    bg: '#0B0C0F', surface: '#14161B', sidebar: '#0F1014',
    text: '#F4F4F5', textMuted: '#9CA3AF', textSubtle: '#6B7280',
    border: '#252830', borderStrong: '#34373F',
    primary: '#FF6B4A', primarySoft: '#EB8B70', primaryWash: '#2A1410',
    success: '#22C55E', warn: '#F59E0B', crit: '#EF4444', info: '#3B82F6',
    chart1: '#FF6B4A', chart2: '#EB8B70', chart3: '#FBBF77', chart4: '#7CC4B5', chart5: '#7C9CD0',
  },
};

const ThemeContext = createContext(THEMES.dark);
function useTheme() { return useContext(ThemeContext); }

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS (lucide-style SVGs)
// ═══════════════════════════════════════════════════════════════════════════════

const Icon = ({ children, size = 16, sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const Icons = {
  Dashboard: (p) => <Icon {...p}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></Icon>,
  Mail: (p) => <Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></Icon>,
  Activity: (p) => <Icon {...p}><path d="M3 12h4l3-8 4 16 3-8h4"/></Icon>,
  Server: (p) => <Icon {...p}><rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/><circle cx="7" cy="7.5" r=".7" fill="currentColor"/><circle cx="7" cy="16.5" r=".7" fill="currentColor"/></Icon>,
  Bell: (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>,
  ArrowUp: (p) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7"/></Icon>,
  ArrowDown: (p) => <Icon {...p}><path d="M12 5v14M5 12l7 7 7-7"/></Icon>,
  Moon: (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>,
  Sun: (p) => <Icon {...p}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></Icon>,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TICKER (live data simulation)
// ═══════════════════════════════════════════════════════════════════════════════

const TickContext = createContext(0);
function useTick() { return useContext(TickContext); }

function TickerProvider({ children }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 2200); return () => clearInterval(id); }, []);
  return <TickContext.Provider value={tick}>{children}</TickContext.Provider>;
}

function walk(length, base, vol, seed) {
  const r = (() => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const out = []; let v = base;
  for (let i = 0; i < length; i++) { v += (r() - 0.5) * vol; out.push(Math.max(0, v)); }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS (repurposed from Anuba lib/components.jsx)
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, style, onClick }) {
  const t = useTheme();
  return (
    <div onClick={onClick} style={{ background: t.surface, border: '1px solid ' + t.border, borderRadius: 10, padding: 14, transition: 'border-color .15s', cursor: onClick ? 'pointer' : 'default', ...style }}>{children}</div>
  );
}

function KpiCard({ label, value, change, sublabel, sparkline, accent }) {
  const t = useTheme();
  const positive = change != null && change >= 0;
  const fmtChange = change == null ? null : (positive ? '+' : '') + change.toFixed(1) + '%';
  return (
    <Card style={{ minHeight: 92, position: 'relative', overflow: 'hidden' }}>
      {accent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />}
      <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
        <div>
          {fmtChange != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: positive ? t.success : t.crit }}>
              {positive ? <Icons.ArrowUp size={10} sw={2.4}/> : <Icons.ArrowDown size={10} sw={2.4}/>} {fmtChange}
            </span>
          )}
          {sublabel && <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>{sublabel}</div>}
        </div>
        {sparkline && <div style={{ width: 72, height: 24 }}><Sparkline data={sparkline} stroke={accent || t.primary}/></div>}
      </div>
    </Card>
  );
}

function Sparkline({ data, stroke }) {
  const t = useTheme();
  const w = 72, h = 24;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 2) - 1]);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const c = stroke || t.primary;
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} width="100%" height="100%" preserveAspectRatio="none">
      <path d={d + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z'} fill={c} fillOpacity={0.1} />
      <path d={d} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status }) {
  const t = useTheme();
  const map = { healthy: { c: t.success, l: 'LIVE' }, degraded: { c: t.warn, l: 'DEGRADED' }, unavailable: { c: t.crit, l: 'DOWN' }, idle: { c: t.textMuted, l: 'IDLE' } };
  const s = map[status] || map.idle;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: s.c }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.c, animation: status === 'healthy' ? 'pulseDot 1.6s infinite' : 'none' }} />
      {s.l}
    </span>
  );
}

function LiveDot() {
  const t = useTheme();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, color: t.success, textTransform: 'uppercase', letterSpacing: '.04em' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.success, animation: 'pulseDot 1.6s infinite' }} />
      Live
    </span>
  );
}

function Section({ title, eyebrow, children, action }) {
  const t = useTheme();
  return (
    <section style={{ marginBottom: 20 }}>
      {(title || eyebrow) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            {eyebrow && <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: t.textSubtle, fontWeight: 600, marginBottom: 2 }}>{eyebrow}</div>}
            {title && <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

function RollupView({ queue, adapters }) {
  const t = useTheme();
  const tick = useTick();
  if (!queue || !adapters) return <div style={{padding:20,color:t.textMuted}}>Loading...</div>;

  return (
    <div className="fade-in" style={{ padding: 16 }}>
      <Section eyebrow="Command Center" title="Correspondence Rollup">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <KpiCard label="Ingested" value={queue.summary.totalIngested} sublabel="raw messages" sparkline={walk(12, queue.summary.totalIngested, 3, 1)} />
          <KpiCard label="Today" value={queue.summary.today} accent={t.crit} sublabel="≥ 0.70 score" change={queue.summary.today > 2 ? 12 : -5} sparkline={walk(12, queue.summary.today, 1, 2)} />
          <KpiCard label="Tomorrow" value={queue.summary.tomorrow} accent={t.warn} sublabel="0.40 – 0.69" sparkline={walk(12, queue.summary.tomorrow, 1, 3)} />
          <KpiCard label="This Week" value={queue.summary.thisWeek} accent={t.info} sublabel="< 0.40" sparkline={walk(12, queue.summary.thisWeek, 1, 4)} />
          <KpiCard label="Adapters" value={adapters.adapters.filter(a => a.status === 'healthy').length + '/' + adapters.adapters.length} accent={t.success} sublabel="channels live" />
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <Section eyebrow="Priority Queue" title="Today's Responses">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.items.today.map((item, i) => <QueueItem key={i} item={item} rank={i+1} />)}
            {queue.items.today.length === 0 && <Card><span style={{color:t.textMuted,fontSize:12}}>No urgent items — inbox zero 🎉</span></Card>}
          </div>
        </Section>

        <div>
          <Section eyebrow="Channel Health" title="Adapters">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {adapters.adapters.map((a, i) => (
                <Card key={i} style={{ padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{channelIcon(a.name)}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{a.displayName}</span>
                  </div>
                  <StatusPill status={a.status} />
                </Card>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function QueueView({ queue }) {
  const t = useTheme();
  if (!queue) return null;

  const buckets = [
    { key: 'today', label: '🔴 Today', items: queue.items.today, color: t.crit },
    { key: 'tomorrow', label: '🟡 Tomorrow', items: queue.items.tomorrow, color: t.warn },
    { key: 'thisWeek', label: '🔵 This Week', items: queue.items.thisWeek, color: t.info },
  ];

  return (
    <div className="fade-in" style={{ padding: 16 }}>
      <Section eyebrow={'Scored ' + queue.summary.totalIngested + ' → ' + queue.summary.afterDedup + ' unique'} title="Correspondence Queue">
        {buckets.map(b => (
          <div key={b.key} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: b.color, marginBottom: 8 }}>{b.label} ({b.items.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {b.items.map((item, i) => <QueueItem key={i} item={item} rank={i+1} />)}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function AdaptersView({ adapters }) {
  const t = useTheme();
  if (!adapters) return null;

  return (
    <div className="fade-in" style={{ padding: 16 }}>
      <Section eyebrow="MCP Integrations" title="Channel Adapters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {adapters.adapters.map((a, i) => (
            <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>{channelIcon(a.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.displayName}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{a.note || (a.messages != null ? a.messages + ' messages' : a.deals ? a.deals + ' deals' : a.tasks != null ? a.tasks + ' tasks' : a.prs ? a.prs + ' PRs' : '')}</div>
                {a.lastIngest && <div style={{ fontSize: 10, color: t.textSubtle }}>Last: {a.lastIngest}</div>}
              </div>
              <StatusPill status={a.status} />
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ActivityView({ activity }) {
  const t = useTheme();
  if (!activity) return null;
  const typeColors = { score: t.primary, ingest: t.success, warn: t.warn, dedup: t.info, system: t.textMuted, send: t.success, action: t.primary };

  return (
    <div className="fade-in" style={{ padding: 16 }}>
      <Section eyebrow="Event Log" title="Recent Activity">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activity.events.map((ev, i) => (
            <Card key={i} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 3, height: 28, borderRadius: 2, background: typeColors[ev.type] || t.textMuted }} />
              <div style={{ width: 42, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: t.textMuted }}>{ev.time}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{ev.action}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{ev.detail}</div>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function QueueItem({ item, rank }) {
  const t = useTheme();
  const scoreColor = item.score >= 0.7 ? t.crit : item.score >= 0.4 ? t.warn : t.info;
  const pct = Math.round(item.score * 100);
  return (
    <Card style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 14 }}>{channelIcon(item.channel)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{item.contactName}</div>
        <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.subject}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: scoreColor, fontWeight: 600 }}>{item.score.toFixed(2)}</span>
        <div style={{ width: 48, height: 4, borderRadius: 2, background: t.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: scoreColor, borderRadius: 2 }} />
        </div>
      </div>
    </Card>
  );
}

function channelIcon(name) {
  const icons = { gmail: '📧', outlook: '📨', linkedin: '💬', hubspot: '💼', confluence: '🏢', github: '🐙', slack: '💬', 'super-productivity': '✅' };
  return icons[name] || '📋';
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  const [themeName, setThemeName] = useState('dark');
  const [view, setView] = useState('rollup');
  const [queue, setQueue] = useState(null);
  const [adapters, setAdapters] = useState(null);
  const [activity, setActivity] = useState(null);

  const theme = THEMES[themeName];

  useEffect(() => {
    fetch('/api/queue').then(r => r.json()).then(setQueue);
    fetch('/api/adapters').then(r => r.json()).then(setAdapters);
    fetch('/api/activity').then(r => r.json()).then(setActivity);
    const id = setInterval(() => { fetch('/api/queue').then(r => r.json()).then(setQueue); }, 30000);
    return () => clearInterval(id);
  }, []);

  const navItems = [
    { id: 'rollup', icon: <Icons.Dashboard size={18}/>, label: 'Command' },
    { id: 'queue', icon: <Icons.Mail size={18}/>, label: 'Queue' },
    { id: 'adapters', icon: <Icons.Server size={18}/>, label: 'Adapters' },
    { id: 'activity', icon: <Icons.Activity size={18}/>, label: 'Activity' },
  ];

  return (
    <ThemeContext.Provider value={theme}>
      <TickerProvider>
        <div style={{ display: 'flex', height: '100%', background: theme.bg, color: theme.text }}>
          {/* Sidebar */}
          <div style={{ width: 56, background: theme.sidebar, borderRight: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 4 }}>
            {/* Logo */}
            <div style={{ width: 32, height: 32, borderRadius: 8, background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>C</div>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} title={n.label}
                style={{ width: 40, height: 40, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: view === n.id ? theme.primaryWash : 'transparent',
                  color: view === n.id ? theme.primary : theme.textMuted,
                  transition: 'all .15s' }}>
                {n.icon}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setThemeName(themeName === 'dark' ? 'coral' : 'dark')} title="Toggle theme"
              style={{ width: 40, height: 40, borderRadius: 8, border: 'none', background: 'transparent', color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {themeName === 'dark' ? <Icons.Sun size={16}/> : <Icons.Moon size={16}/>}
            </button>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* TopBar */}
            <div style={{ height: 48, borderBottom: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>CorrespondOS</span>
                <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8 }}>v0.1.0 · Multi-channel triage</span>
              </div>
              <LiveDot />
            </div>

            {/* View */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {view === 'rollup' && <RollupView queue={queue} adapters={adapters} />}
              {view === 'queue' && <QueueView queue={queue} />}
              {view === 'adapters' && <AdaptersView adapters={adapters} />}
              {view === 'activity' && <ActivityView activity={activity} />}
            </div>
          </div>
        </div>
      </TickerProvider>
    </ThemeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>`;
}

// ─── Server Start ───────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3000');
console.log(`🚀 CorrespondOS Dashboard running at http://localhost:${port}`);

export default { port, fetch: app.fetch };

# CorrespondOS Dashboard — UX/UI Requirements Document

**Version:** 1.0
**Date:** May 6, 2026
**Author:** Jonathan Lyn-Shue (CIO / Product Owner)
**Status:** DRAFT — Pending design review

---

## 1. Executive Summary

CorrespondOS is a multi-channel correspondence triage engine that ingests messages from 8+ communication channels, normalizes them, scores priority using a weighted model, and presents an actionable queue. This document defines the complete requirements for the dashboard interface — the primary surface through which users interact with the system.

**Primary goal:** Reduce time-to-first-response across all communication channels from hours to minutes by providing instant visibility into what matters most.

**Target audience:** Solo founder/exec managing 8+ communication channels simultaneously. Eventually: small team leads, RevOps managers, executive assistants.

**Design philosophy:** Control-room density with progressive disclosure. Every pixel earns its place. Data-ink ratio maximized. No decoration without information.

---

## 2. Current State Audit

### 2.1 What Exists Today

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| Hono API server | ✅ Running | `packages/web/src/server.ts` | 4 endpoints |
| Single-page dashboard | ✅ Running | Inline HTML in server.ts | React 18 + Babel |
| 4 views (Rollup, Queue, Adapters, Activity) | ✅ Functional | Inline JSX | Dark/Coral toggle |
| Scoring engine integration | ✅ Live | API → Core engine | Real scoring on each request |
| Demo data (10 messages) | ⚠️ Static | Hardcoded in server.ts | No live MCP connection |
| 5 unit tests | ✅ Passing | `server.test.ts` | API endpoint coverage |

### 2.2 Current API Surface

| Endpoint | Method | Response | Data Source |
|----------|--------|----------|-------------|
| `/api/health` | GET | App status + version | Static |
| `/api/queue` | GET | Scored items in buckets | Core engine (demo data) |
| `/api/adapters` | GET | Adapter health status | Static mock |
| `/api/activity` | GET | Event log entries | Static mock |
| `/` | GET | Full HTML dashboard | Server-rendered |

### 2.3 Current Screens

| View | Purpose | Components | Gaps |
|------|---------|-----------|------|
| **Rollup** | Executive glance | 5 KpiCards, QueueItems, AdapterGrid | No drill-down, no actions, no time range |
| **Queue** | Full priority queue | 3-bucket list with score bars | No item detail, no draft action, no filters |
| **Adapters** | Channel health | 2-col cards with StatusPills | No config, no history, no reconnect action |
| **Activity** | Event log | Timestamped card list | No filtering, no search, no pagination |

### 2.4 Identified Gaps

| Gap | Severity | Impact |
|-----|----------|--------|
| No item detail view (full message body, research dossier) | 🔴 Critical | Can't act on items without seeing context |
| No draft/respond workflow | 🔴 Critical | Defeats the purpose — user must go to source app |
| No live MCP data | 🔴 Critical | Dashboard is a demo, not functional |
| No time-range filtering | 🟡 High | Can't compare today vs. this week |
| No contact/company enrichment view | 🟡 High | Missing context for scoring decisions |
| No search/filter on queue | 🟡 High | Can't find specific contact or channel |
| No persistence (queue state resets) | 🟡 High | Lose triage decisions on refresh |
| No response templates integration | 🟠 Medium | Must compose manually |
| No keyboard shortcuts | 🟠 Medium | Power users expect j/k navigation |
| No mobile responsiveness | 🔵 Low | Primary use is desktop |
| No real-time WebSocket updates | 🔵 Low | 30s polling is acceptable for v1 |

---

## 3. Screens & Components Inventory

### 3.1 Screen Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                          APP SHELL                                    │
│  ┌────────┐  ┌──────────────────────────────────────────────────┐   │
│  │SIDEBAR │  │              VIEW AREA                            │   │
│  │        │  │                                                    │   │
│  │ [Logo] │  │  ┌─── TOP BAR ──────────────────────────────┐    │   │
│  │ [Nav]  │  │  │ Title │ Breadcrumb │ Range │ Live │ User │    │   │
│  │ [Nav]  │  │  └───────────────────────────────────────────┘    │   │
│  │ [Nav]  │  │                                                    │   │
│  │ [Nav]  │  │  ┌─── CONTENT ──────────────────────────────┐    │   │
│  │        │  │  │                                           │    │   │
│  │        │  │  │  (View-specific content)                  │    │   │
│  │        │  │  │                                           │    │   │
│  │ [...]  │  │  └───────────────────────────────────────────┘    │   │
│  │[Theme] │  │                                                    │   │
│  └────────┘  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Complete Screen List (Target State)

| # | Screen | URL Path | Purpose | Priority |
|---|--------|----------|---------|----------|
| 1 | **Command (Rollup)** | `/` | Executive glance — KPIs + top items + health | Must-Have |
| 2 | **Queue** | `/queue` | Full scored queue with filters | Must-Have |
| 3 | **Item Detail** | `/queue/:id` | Full message, research dossier, draft panel | Must-Have |
| 4 | **Adapters** | `/adapters` | Channel health, config, reconnect | Must-Have |
| 5 | **Activity** | `/activity` | Event log with search/filter | Should-Have |
| 6 | **Contacts** | `/contacts` | CRM-enriched contact cards | Should-Have |
| 7 | **Analytics** | `/analytics` | Response time trends, channel volume, scoring distribution | Could-Have |
| 8 | **Settings** | `/settings` | Scoring weights, adapter config, templates | Could-Have |

### 3.3 Component Library (Target)

| Component | Used In | Status | Anuba Source |
|-----------|---------|--------|--------------|
| `AppShell` | All | ✅ Exists | `lib/components.jsx` |
| `Sidebar` | All | ✅ Exists (simplified) | `lib/components.jsx` |
| `TopBar` | All | ✅ Exists (simplified) | `lib/components.jsx` |
| `KpiCard` | Rollup, Analytics | ✅ Exists | `lib/components.jsx` |
| `Card` | All | ✅ Exists | `lib/components.jsx` |
| `Sparkline` | KpiCard, Analytics | ✅ Exists | `lib/components.jsx` |
| `StatusPill` | Adapters, Queue | ✅ Exists | `lib/components.jsx` |
| `LiveDot` | TopBar | ✅ Exists | `lib/components.jsx` |
| `Section` | All content | ✅ Exists | `lib/components.jsx` |
| `QueueItem` | Queue, Rollup | ✅ Exists (custom) | New for CorrespondOS |
| `Table` | Contacts, Analytics | 🔨 Needed | `lib/components.jsx` |
| `AreaChart` | Analytics | 🔨 Needed | `lib/components.jsx` |
| `BarChart` | Analytics | 🔨 Needed | `lib/components.jsx` |
| `Donut` | Rollup (channel mix) | 🔨 Needed | `lib/components.jsx` |
| `MultiLineChart` | Analytics (trends) | 🔨 Needed | `lib/components.jsx` |
| `DetailPanel` | Item Detail | 🔨 Needed | Inspired by `signal.jsx` 3-pane |
| `DraftEditor` | Item Detail | 🔨 Needed | New — textarea + template selector |
| `FilterBar` | Queue, Activity | 🔨 Needed | New — channel/severity/tier chips |
| `ScoreBreakdown` | Item Detail | 🔨 Needed | New — 4-factor visual breakdown |
| `CommandPalette` | Global | 🔨 Needed | New — ⌘K quick actions |
| `Tooltip` | Everywhere | 🔨 Needed | New — hover context |
| `Badge` | Sidebar nav | 🔨 Needed | From Anuba sidebar pattern |

---

## 4. Data Model & Data Governance

### 4.1 Core Schema (from `packages/shared/src/types.ts`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA MODEL                                   │
│                                                                      │
│  NormalizedMessage                                                    │
│  ├── id (UUID)                                                       │
│  ├── source (Channel enum)                                           │
│  ├── sourceMessageId                                                 │
│  ├── contactName                                                     │
│  ├── contactEmail                                                    │
│  ├── company                                                         │
│  ├── subject                                                         │
│  ├── bodySnippet                                                     │
│  ├── timestamp (Date)                                                │
│  ├── channel (Channel enum)                                          │
│  ├── hubspotDealId                                                   │
│  ├── urgencySignals[] (UrgencySignal enum)                           │
│  ├── relationshipTier (RelationshipTier enum)                        │
│  └── metadata (Record<string, unknown>)                              │
│         │                                                            │
│         ▼ ScoreEngine                                                │
│  ScoredItem extends NormalizedMessage                                │
│  ├── score (0.0 – 1.0)                                              │
│  ├── bucket (today | tomorrow | this-week)                           │
│  ├── scoreBreakdown                                                  │
│  │   ├── revenueImpact (0.0 – 1.0)                                  │
│  │   ├── timeSensitivity (0.0 – 1.0)                                │
│  │   ├── relationshipTier (0.0 – 1.0)                                │
│  │   └── channelUrgency (0.0 – 1.0)                                 │
│  ├── mergedFrom[] (string[])                                         │
│  └── syncMismatch (boolean)                                          │
│         │                                                            │
│         ▼ DraftEngine                                                │
│  DraftResponse                                                       │
│  ├── itemId (references ScoredItem.id)                               │
│  ├── subject                                                         │
│  ├── body                                                            │
│  ├── channel (submission channel)                                    │
│  ├── templateUsed                                                    │
│  ├── tone (professional | warm | collaborative | data-driven)        │
│  ├── status (draft | approved | sent | skipped)                      │
│  ├── createdAt                                                       │
│  └── sentAt                                                          │
│                                                                      │
│  CorrespondenceQueue                                                 │
│  ├── id (UUID)                                                       │
│  ├── createdAt                                                       │
│  ├── totalIngested                                                   │
│  ├── afterDedup                                                      │
│  ├── items[] (ScoredItem[])                                          │
│  ├── drafts[] (DraftResponse[])                                      │
│  ├── channelStatus (Record<Channel, status>)                         │
│  └── syncMismatches (number)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Enums & Constants

| Enum | Values | Dashboard Display |
|------|--------|-------------------|
| **Channel** | gmail, outlook, hubspot, apollo, linkedin, confluence, slack, super-productivity, obsidian, github, custom | Icon + name in queue items |
| **PriorityBucket** | today, tomorrow, this-week, backlog | Color-coded sections |
| **UrgencySignal** | deadline-today, flagged, high-importance, mentions-urgent, meeting-followup, stale-deal, unread-dm, ci-failure, token-expiring, custom | Tags/badges on items |
| **RelationshipTier** | customer, opportunity, partner, lead, subscriber, internal, unknown | Tier badge on contact |

### 4.3 Data Sources & Lineage

```
MCP Servers (8)                    Core Engine                    Dashboard
─────────────────────────────────  ─────────────────────────────  ──────────────────
                                   
google-workspace  ──┐              ┌─────────────┐
lokka-microsoft  ───┤  Adapters    │  Normalizer │ → NormalizedMessage[]
hubspot          ───┤ ──────────── │  Deduplicator│ → Deduplicated[]
apollo           ───┤              │  ScoreEngine │ → ScoredItem[]       → /api/queue
confluence       ───┤              └─────────────┘                        → /api/adapters
playwright/kapture──┤                                                     → /api/activity
slack            ───┤              ┌─────────────┐                        → /api/contacts
super-productivity──┘              │  Persistence │ → SQLite DB           → /api/analytics
                                   │  (store.ts)  │
                                   └─────────────┘
```

### 4.4 Data Governance & Privacy

| Concern | Policy | Implementation |
|---------|--------|----------------|
| **PII in messages** | Body snippets truncated to 200 chars. Full body only on explicit item-detail request. | API returns `bodySnippet` by default; `/api/queue/:id` returns full body |
| **Email addresses** | Stored for dedup/matching. Not exposed in bulk API responses without auth. | Require session token for `/api/queue` |
| **OAuth tokens** | Never stored in dashboard DB. Live in MCP server env/keychain only. | Dashboard queries MCP via adapters, never touches tokens |
| **HubSpot deal values** | Financial data. Only shown in authenticated dashboard. | `metadata.dealStage` exposed; `amount` only in detail view |
| **Local-first** | All data stays on the user's machine (SQLite). No telemetry phoned home. | No external analytics, no cloud sync |
| **Session security** | Dashboard runs on localhost. No auth required for local access. | If exposed on network, require Bearer token |

---

## 5. Triaged Views & Workflows

### 5.1 Message Triage Workflow

```
                    INGEST                    TRIAGE                     ACT
              ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
              │ Raw messages  │        │ Scored queue  │        │ Draft/Send    │
              │ from 8+      │──────▶ │ with priority │──────▶ │ or Skip       │
              │ channels      │        │ buckets       │        │               │
              └───────────────┘        └───────────────┘        └───────────────┘
                     │                        │                        │
                     ▼                        ▼                        ▼
              Adapter health            Score breakdown           Log to Obsidian
              Error handling            Filter/search            Update HubSpot
              Dedup results             Research dossier         Create SP task
```

### 5.2 Every Dataset — Where It Appears

| Dataset | Command View | Queue View | Detail View | Adapters | Activity | Contacts | Analytics |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ScoredItems | Top 3 | All | Single item | — | — | By contact | Distribution |
| DraftResponses | — | Badge count | Full editor | — | Sent log | History | Response time |
| AdapterHealth | Summary count | — | — | Full detail | Status changes | — | Uptime % |
| UrgencySignals | — | Tags | Tags + detail | — | — | — | Frequency |
| ScoreBreakdown | — | Score bar | 4-factor visual | — | — | — | Weight analysis |
| ContactEnrichment | — | Name + company | Full profile | — | — | Full card | — |
| ChannelStatus | Health strip | Filter option | Source badge | Full grid | Transitions | — | Volume by channel |
| ActivityEvents | — | — | — | — | Full log | — | Event frequency |
| Templates | — | — | Template picker | — | — | — | Usage stats |
| Correspondence Log | Today count | — | Previous entries | — | Send events | Thread history | Volume/day |

### 5.3 Triage States for Queue Items

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  UNREAD  │────▶│  VIEWED  │────▶│  DRAFTED │────▶│   SENT   │
│ (scored) │     │(detail   │     │(response │     │(delivered│
│          │     │ opened)  │     │ composed)│     │ + logged)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │                │                │
      ▼                ▼                ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  SKIPPED │     │  SNOOZED │     │ ESCALATED│
│(not now) │     │(remind   │     │(delegate)│
│          │     │ tomorrow)│     │          │
└──────────┘     └──────────┘     └──────────┘
```

---

## 6. Requirements by Priority

### 6.1 Must-Have (P0) — Ship Blocker

| ID | Requirement | Acceptance Criteria | Rationale |
|----|-------------|--------------------| ----------|
| P0-1 | **Live MCP ingestion** | Dashboard pulls real messages from at least Gmail + Outlook adapters on load | Without real data, dashboard is unusable |
| P0-2 | **Item detail panel** | Clicking a queue item opens a side panel showing: full subject, body, sender, timestamp, score breakdown, urgency signals, relationship tier | Users can't triage without reading the message |
| P0-3 | **Draft response workflow** | Detail panel includes a text area + template selector + "Save Draft" + "Skip" buttons. Draft saves to persistence layer | Core value prop — draft responses without leaving the dashboard |
| P0-4 | **Queue filtering** | Filter by: channel, bucket, relationship tier, urgency signal. Free-text search on contact name and subject | 10+ items in queue means user needs to find specific ones |
| P0-5 | **Adapter reconnect action** | Adapters view shows a "Reconnect" button for degraded/unavailable adapters. Triggers health check on click | Users need to self-service connection issues |
| P0-6 | **Persistence across refreshes** | Queue state (viewed, drafted, skipped) persists in SQLite. Page refresh doesn't lose triage progress | Losing state = redoing work |
| P0-7 | **Score breakdown visualization** | 4-factor horizontal stacked bar (Revenue 40% + Time 30% + Relationship 20% + Channel 10%) visible in detail panel | Users need to understand WHY something scored high |

### 6.2 Should-Have (P1) — v0.2 Release

| ID | Requirement | Acceptance Criteria | Rationale |
|----|-------------|--------------------| ----------|
| P1-1 | **Template integration** | Drafting panel offers 7 templates from `/correspond-template`. Variables auto-fill from item context | Faster response composition |
| P1-2 | **Contact enrichment card** | Detail panel shows: Apollo enrichment (title, company, LinkedIn), HubSpot deal info, past correspondence count | Context-aware responses |
| P1-3 | **Keyboard navigation** | `j`/`k` move between items, `Enter` opens detail, `Esc` closes, `d` starts draft, `s` skips, `⌘K` command palette | Power user efficiency |
| P1-4 | **Time range selector** | TopBar range picker: Today, 24h, 7d, 30d. Filters queue + activity by ingestion time | Historical view for catch-up |
| P1-5 | **Activity search + filter** | Activity view has text search and type filter (ingest/score/send/warn/system) | Finding specific events in growing log |
| P1-6 | **Batch actions** | Checkbox selection + "Skip selected" / "Snooze selected" on queue | Bulk triage for newsletter-type items |
| P1-7 | **Snooze mechanic** | "Snooze until tomorrow" action on any item. Removes from today bucket, re-surfaces next day | Intentional deferral without losing track |

### 6.3 Could-Have (P2) — v0.3+

| ID | Requirement | Acceptance Criteria | Rationale |
|----|-------------|--------------------| ----------|
| P2-1 | **Analytics screen** | Response time trend (7d/30d), volume by channel (bar), scoring distribution (histogram), daily throughput | Self-awareness on triage habits |
| P2-2 | **Contacts screen** | CRM-style contact list with last-contact date, total interactions, relationship tier, enrichment status | Relationship management view |
| P2-3 | **Settings screen** | Adjustable scoring weights (sliders summing to 1.0), adapter toggle on/off, template editor | Personalization |
| P2-4 | **WebSocket live updates** | Queue auto-updates when new messages arrive (no manual refresh) | True real-time feel |
| P2-5 | **Multi-user support** | Bearer token auth, multiple user profiles, shared queue with claim mechanic | Team scaling |
| P2-6 | **Mobile responsive layout** | Sidebar collapses to bottom tab bar, cards stack vertically, detail becomes full-screen | On-the-go triage |
| P2-7 | **Email send integration** | "Send" button in draft panel actually sends via Gmail/Outlook MCP (with confirmation modal) | End-to-end without leaving dashboard |

---

## 7. UX/UI Guidelines & Accessibility

### 7.1 Design Principles

1. **Data density over decoration** — Every element communicates information. No empty states without guidance.
2. **Progressive disclosure** — Rollup → Queue → Detail. Each level reveals more.
3. **Consistent mental model** — Same item looks the same everywhere (icon + name + subject + score bar).
4. **Non-destructive defaults** — All actions are reversible. Draft-first, never auto-send.
5. **Graceful degradation** — Unavailable channels are visible but don't block the workflow.

### 7.2 Layout Patterns

| Pattern | Usage | Spec |
|---------|-------|------|
| **Sidebar + Content** | App shell | Sidebar: 56px (icons only, expandable to 200px with labels) |
| **KPI Card Row** | Rollup top | 5 cards, equal width, min-height 92px |
| **2-Column Split** | Rollup body | Left 60% (queue), Right 40% (adapters/info) |
| **3-Bucket List** | Queue view | Today (red accent), Tomorrow (amber), This Week (blue) |
| **Master-Detail** | Queue + Detail | List 40% width, detail panel 60% (slide-in from right) |
| **Stacked Cards** | All list views | Cards with 6px gap, 10px border-radius, 14px padding |

### 7.3 Typography

| Element | Font | Size | Weight | Tracking |
|---------|------|------|--------|----------|
| KPI value | JetBrains Mono | 22px | 600 | -0.02em |
| KPI label | Inter | 10.5px | 600 | 0.04em (uppercase) |
| Section title | Inter | 13.5px | 600 | -0.005em |
| Section eyebrow | Inter | 10px | 600 | 0.08em (uppercase) |
| Body text | Inter | 12px | 400 | normal |
| Table header | Inter | 10.5px | 600 | 0.04em (uppercase) |
| Score values | JetBrains Mono | 11px | 600 | normal |
| Timestamps | JetBrains Mono | 11px | 500 | normal |

### 7.4 Color System

| Token | Light (Coral) | Dark | Usage |
|-------|---------------|------|-------|
| `primary` | `#E84B26` | `#FF6B4A` | Accents, active states, brand |
| `success` | `#16A34A` | `#22C55E` | Healthy, positive change, live |
| `warn` | `#D97706` | `#F59E0B` | Degraded, tomorrow bucket |
| `crit` | `#DC2626` | `#EF4444` | Today bucket, errors, critical |
| `info` | `#2563EB` | `#3B82F6` | This-week bucket, informational |
| `surface` | `#FFFFFF` | `#14161B` | Cards, panels |
| `bg` | `#F4F4F5` | `#0B0C0F` | Page background |
| `border` | `#E5E7EB` | `#252830` | Card borders, dividers |

### 7.5 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| WCAG 2.1 AA contrast | All text ≥ 4.5:1 on backgrounds. Verified for both themes |
| Keyboard navigable | All interactive elements focusable via Tab. Custom j/k navigation |
| Screen reader | Semantic HTML (headings, landmarks, lists). `aria-label` on icon-only buttons |
| Color not sole indicator | Score bars have numeric labels. Status pills have text + dot |
| Motion reduced | `prefers-reduced-motion` disables pulseDot animation |
| Focus visible | Clear focus ring (2px offset) on all interactive elements |

---

## 8. Delivery Plan & Milestones

### 8.1 Phased Delivery

| Phase | Milestone | Contents | Target | Effort |
|-------|-----------|----------|--------|--------|
| **α (Current)** | Dashboard MVP running | 4 views, mock data, Anuba design system | ✅ Done | — |
| **β1** | Live Data + Detail Panel | P0-1 through P0-3 | Week 1 | 8 hrs |
| **β2** | Filtering + Persistence | P0-4 through P0-7 | Week 2 | 6 hrs |
| **v0.2** | Templates + Keyboard + Enrichment | P1-1 through P1-7 | Week 3-4 | 10 hrs |
| **v0.3** | Analytics + Contacts + Settings | P2-1 through P2-3 | Month 2 | 12 hrs |
| **v1.0** | WebSocket + Send + Mobile | P2-4 through P2-7 | Month 3 | 16 hrs |

### 8.2 Ownership

| Area | Owner | Notes |
|------|-------|-------|
| UX/UI design decisions | Jon (CIO) | Final authority on layout and behavior |
| Core scoring engine | Jon | Already built and tested |
| Adapter implementation | Jon / Engineering | Gmail + Outlook done; others queued |
| Dashboard frontend | Jon | React inline → proper React app (phase β2+) |
| API server | Jon | Hono, already scaffolded |
| Persistence layer | Jon | SQLite via persistence module (built) |

---

## 9. Wireframes & Layout Suggestions

### 9.1 Item Detail Panel (P0-2)

```
┌─────────────── Queue List (40%) ───┐┌─────────── Detail Panel (60%) ──────────┐
│                                     ││                                          │
│  🔴 Today (3)                       ││  ← Back to queue                        │
│  ┌───────────────────────────────┐  ││                                          │
│  │ 📧 Leon Davoyan         0.81 │◄─┤│  📧 gmail · 2 days ago                  │
│  └───────────────────────────────┘  ││  From: Leon Davoyan <leon@dhc.com>      │
│  ┌───────────────────────────────┐  ││  Subject: Re: Partnership Proposal      │
│  │ 💼 Hamed Farsani        0.78 │  ││                                          │
│  └───────────────────────────────┘  ││  ─── Score Breakdown ────────────────── │
│  ┌───────────────────────────────┐  ││  Revenue  ████████████████░░░░  0.90    │
│  │ 📨 Robert McDonnell     0.71 │  ││  Time     ██████████████░░░░░░  0.70    │
│  └───────────────────────────────┘  ││  Relation ████████████████░░░░  0.80    │
│                                     ││  Channel  ████████████████░░░░  0.80    │
│  🟡 Tomorrow (4)                    ││  ═══════════════════════════ Total: 0.81│
│  ┌───────────────────────────────┐  ││                                          │
│  │ 💬 Sarah Chen           0.62 │  ││  ─── Context ────────────────────────── │
│  └───────────────────────────────┘  ││  Deal: DHC Partnership (Negotiation)    │
│  ┌───────────────────────────────┐  ││  Company: Digital Health Corp           │
│  │ 🐙 GitHub Actions       0.55 │  ││  Last contact: 2 days ago               │
│  └───────────────────────────────┘  ││  Signals: stale-deal                    │
│  ...                                ││                                          │
│                                     ││  ─── Message Body ──────────────────── │
│                                     ││  "Hi Jon, wanted to follow up on our    │
│                                     ││   conversation about the partnership... │
│                                     ││   Looking forward to hearing back."     │
│                                     ││                                          │
│                                     ││  ─── Actions ───────────────────────── │
│                                     ││  [📝 Draft Reply] [⏭️ Skip] [⏰ Snooze] │
│                                     ││                                          │
│                                     ││  ─── Draft (template: follow-up-warm) ─ │
│                                     ││  ┌──────────────────────────────────┐   │
│                                     ││  │ Subject: Following up — Partnersh│   │
│                                     ││  │                                  │   │
│                                     ││  │ Hi Leon,                         │   │
│                                     ││  │                                  │   │
│                                     ││  │ I wanted to circle back on our   │   │
│                                     ││  │ conversation about the partner...│   │
│                                     ││  └──────────────────────────────────┘   │
│                                     ││  Via: gmail │ [Save Draft] [Send ▸]     │
└─────────────────────────────────────┘└──────────────────────────────────────────┘
```

### 9.2 Filter Bar (P0-4)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search contact or subject...  │ Channel: [All ▾] │ Tier: [All ▾] │ ✕ Clear │
│                                   │ Signal: [All ▾]  │ Bucket: [All ▾]│          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Score Breakdown Component (P0-7)

```
Revenue Impact (40%)      ████████████████████░░░░░░░░░░  0.90
Time Sensitivity (30%)    ████████████████████████░░░░░░  0.70
Relationship Tier (20%)   ████████████████████░░░░░░░░░░  0.80
Channel Urgency (10%)     ████████████████████░░░░░░░░░░  0.80
────────────────────────────────────────────────────────────────
Weighted Score:                                            0.81
Bucket: 🔴 TODAY (≥ 0.70)
```

---

## 10. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MCP server instability (HubSpot crashes) | High | Medium | Graceful degradation + auto-retry + health monitoring |
| Token expiration mid-session (Lokka) | High | High | Health check on page load + clear "Refresh token" CTA |
| Too many items overwhelm the queue (>50) | Medium | Medium | Default to Today only; paginate Tomorrow/This Week |
| User accidentally sends via "Send" button | Low | High | Confirmation modal + 5-second undo |
| SQLite corruption on crash | Low | Medium | WAL mode + periodic backup + graceful error recovery |
| Browser performance with 100+ items | Low | Low | Virtual scrolling for long lists |

---

## 11. Acceptance Criteria & Success Metrics

### 11.1 Functional Acceptance

| Criterion | Test |
|-----------|------|
| Dashboard loads in <2s | Measure from navigation to first KPI card rendered |
| All 8 adapters represented | Adapters view shows all 8 with correct status |
| Queue accurately reflects scoring | Items sorted by score descending within buckets |
| Detail panel shows all fields | Subject, from, body, score breakdown, signals, tier, deal info |
| Draft saves and persists | Compose draft, refresh page, draft still exists |
| Skip removes from queue | Skip an item, it doesn't appear in "Today" bucket again |
| Filter narrows results correctly | Filter to "gmail" → only gmail items shown |

### 11.2 Performance

| Metric | Target |
|--------|--------|
| Initial page load | < 2 seconds |
| API response (`/api/queue`) | < 200ms |
| Score computation (10 items) | < 50ms |
| Score computation (100 items) | < 500ms |
| Detail panel open | < 100ms |

### 11.3 Business Success Metrics

| Metric | Baseline | Target (30 days) |
|--------|----------|-------------------|
| Avg time to first response (high-priority) | ~4 hours | < 1 hour |
| Dropped threads per week | ~3 | 0 |
| Daily triage completion rate | N/A | > 90% |
| Items processed per session | N/A | > 10 |

---

## 12. Schemas, Integration Guides & How-To Documentation

### 12.1 API Schema Reference

#### `GET /api/queue`

```typescript
// Response
interface QueueResponse {
  summary: {
    totalIngested: number;
    afterDedup: number;
    today: number;
    tomorrow: number;
    thisWeek: number;
    generatedAt: string; // ISO 8601
  };
  items: {
    today: ScoredItem[];
    tomorrow: ScoredItem[];
    thisWeek: ScoredItem[];
  };
}
```

#### `GET /api/queue/:id`

```typescript
// Response
interface ItemDetailResponse {
  item: ScoredItem;
  fullBody: string | null;
  enrichment: {
    title: string | null;
    company: string | null;
    linkedinUrl: string | null;
    hubspotDealName: string | null;
    hubspotDealStage: string | null;
    hubspotDealAmount: number | null;
    previousCorrespondence: number; // count
  } | null;
  drafts: DraftResponse[];
}
```

#### `POST /api/queue/:id/draft`

```typescript
// Request
interface CreateDraftRequest {
  subject: string;
  body: string;
  channel: Channel;
  templateUsed?: string;
  tone: 'professional' | 'warm' | 'collaborative' | 'data-driven';
}

// Response
interface CreateDraftResponse {
  draft: DraftResponse;
  saved: boolean;
}
```

#### `POST /api/queue/:id/action`

```typescript
// Request
interface ItemActionRequest {
  action: 'skip' | 'snooze' | 'escalate' | 'send';
  snoozeUntil?: string; // ISO 8601 (for snooze)
  escalateTo?: string;  // email (for escalate)
}

// Response
interface ItemActionResponse {
  success: boolean;
  newStatus: string;
}
```

#### `GET /api/adapters`

```typescript
interface AdaptersResponse {
  adapters: {
    name: Channel;
    displayName: string;
    status: 'healthy' | 'degraded' | 'unavailable' | 'idle';
    accounts?: number;
    lastIngest?: string;
    messages?: number;
    deals?: number;
    tasks?: number;
    prs?: number;
    note?: string;
    latencyMs?: number;
  }[];
}
```

#### `POST /api/adapters/:name/reconnect`

```typescript
// Response
interface ReconnectResponse {
  adapter: string;
  previousStatus: string;
  newStatus: string;
  latencyMs: number;
}
```

### 12.2 Database Schema (SQLite)

```sql
-- Queue runs (each triage session)
CREATE TABLE queue_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  total_ingested INTEGER NOT NULL,
  after_dedup INTEGER NOT NULL,
  channel_status TEXT NOT NULL -- JSON
);

-- Scored items
CREATE TABLE scored_items (
  id TEXT PRIMARY KEY,
  queue_run_id TEXT NOT NULL REFERENCES queue_runs(id),
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
  urgency_signals TEXT NOT NULL, -- JSON array
  relationship_tier TEXT NOT NULL,
  metadata TEXT NOT NULL, -- JSON
  score REAL NOT NULL,
  bucket TEXT NOT NULL,
  score_revenue REAL NOT NULL,
  score_time REAL NOT NULL,
  score_relationship REAL NOT NULL,
  score_channel REAL NOT NULL,
  merged_from TEXT, -- JSON array
  sync_mismatch INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unread', -- unread|viewed|drafted|sent|skipped|snoozed
  snoozed_until TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Drafts
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES scored_items(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL,
  template_used TEXT,
  tone TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft|approved|sent|skipped
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

-- Activity log
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  type TEXT NOT NULL, -- ingest|score|dedup|send|warn|system|action
  action TEXT NOT NULL,
  detail TEXT,
  item_id TEXT REFERENCES scored_items(id)
);

-- Indexes
CREATE INDEX idx_items_bucket ON scored_items(bucket);
CREATE INDEX idx_items_status ON scored_items(status);
CREATE INDEX idx_items_score ON scored_items(score DESC);
CREATE INDEX idx_items_contact ON scored_items(contact_email);
CREATE INDEX idx_drafts_item ON drafts(item_id);
CREATE INDEX idx_activity_type ON activity_log(type);
CREATE INDEX idx_activity_time ON activity_log(timestamp DESC);
```

### 12.3 How-To: Adding a New Adapter to the Dashboard

```markdown
## How to Add a New Channel Adapter

1. **Create the adapter** in `packages/adapters/src/<channel>/adapter.ts`
   - Extend `BaseAdapter`
   - Implement `healthCheck()`, `ingest()`, optionally `send()`

2. **Register in the dashboard API** (`packages/web/src/server.ts`)
   - Import the adapter
   - Add to the adapter registry
   - The `/api/adapters` endpoint auto-discovers registered adapters

3. **Add the channel icon** in the dashboard's `channelIcon()` function

4. **Test**
   - Write adapter tests in `adapter.test.ts`
   - Verify it appears in the Adapters view
   - Verify messages from this channel appear in the Queue
```

### 12.4 How-To: Adjusting Scoring Weights

```markdown
## How to Customize Scoring Weights

1. **Modify defaults** in `packages/shared/src/constants.ts`:
   ```typescript
   export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
     revenueImpact: 0.4,    // Adjust (must sum to 1.0)
     timeSensitivity: 0.3,
     relationshipTier: 0.2,
     channelUrgency: 0.1,
   };
   ```

2. **Per-session override** via API (future):
   ```
   POST /api/settings/weights
   { "revenueImpact": 0.5, "timeSensitivity": 0.2, ... }
   ```

3. **Per-run override** via CLI:
   ```bash
   bun run cli -- triage --weight-revenue=0.5 --weight-time=0.2
   ```

4. **Validation**: Engine throws if weights don't sum to 1.0 (±0.01)
```

### 12.5 How-To: Deploying the Dashboard

```markdown
## Running the Dashboard

### Development
```bash
cd correspond-os
bun install
bun run dev:web
# → http://localhost:3000
```

### Production (single machine)
```bash
PORT=3000 bun run packages/web/src/server.ts &
# Dashboard at http://localhost:3000
# API at http://localhost:3000/api/*
```

### With live adapters
1. Ensure MCP servers are running (Goose session or standalone)
2. Configure adapters in `~/.correspond-os/config.json`
3. Start dashboard — adapters auto-connect on first `/api/queue` request

### Docker (future)
```dockerfile
FROM oven/bun:1.1
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
EXPOSE 3000
CMD ["bun", "run", "packages/web/src/server.ts"]
```
```

---

## 13. Conflict Resolution Notes

| Conflict | Resolution |
|----------|-----------|
| Detail panel (P0-2) requires live data (P0-1) for full body | Implement P0-1 first. Detail panel can show `bodySnippet` until live data is connected. |
| Draft workflow (P0-3) requires templates (P1-1) | P0-3 provides free-text drafting only. Template integration is additive in P1. |
| Keyboard shortcuts (P1-3) may conflict with browser shortcuts | Restrict to single-character keys that don't conflict (j/k/d/s). ⌘K uses standard command palette pattern. |
| Dark theme default vs. Anuba coral brand | Dark is better for data-dense dashboards. Coral available via toggle for presentations/screenshots. |

---

*End of requirements document. Implementation begins with Phase β1 (P0-1 through P0-3).*

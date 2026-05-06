# Architecture

## System Overview

CorrespondOS is a multi-channel correspondence triage engine that:

1. **Ingests** messages from 8+ communication channels
2. **Normalizes** them into a unified schema
3. **Deduplicates** by contact (email/name) and topic
4. **Scores** priority using a weighted 4-factor model
5. **Drafts** responses with appropriate tone and channel routing
6. **Presents** a prioritized queue for human review

## Package Structure

```
packages/
├── shared/          # Types, schemas, constants, utilities
│   └── src/
│       ├── types.ts       # Zod schemas + TS types
│       ├── constants.ts   # Scoring weights, thresholds
│       └── utils.ts       # Helper functions
├── core/            # Engine logic (no I/O)
│   └── src/
│       ├── scoring/       # 4-factor scoring engine
│       ├── normalize/     # Raw → NormalizedMessage
│       ├── dedup/         # Contact/subject deduplication
│       └── harness/       # Dev loop validation
├── adapters/        # Channel plugins (I/O boundary)
│   └── src/
│       ├── gmail/         # Google Workspace MCP adapter
│       ├── outlook/       # Lokka Microsoft MCP adapter
│       ├── hubspot/       # HubSpot MCP adapter
│       └── ...
├── cli/             # Command-line interface
│   └── src/
│       └── index.ts       # Commander.js CLI entry
└── web/             # Optional web dashboard
    └── src/
        └── ...            # React 19 + Hono
```

## Scoring Model

```
Score = (Revenue × 0.4) + (Time × 0.3) + (Relationship × 0.2) + (Channel × 0.1)
```

| Factor | Weight | Inputs |
|--------|--------|--------|
| Revenue Impact | 40% | Deal stage, pipeline value, fundraising tags |
| Time Sensitivity | 30% | Deadlines, urgency signals, message age |
| Relationship Tier | 20% | CRM lifecycle stage (Customer > Opportunity > Lead) |
| Channel Urgency | 10% | Channel type + flags (LinkedIn DM > Email > Wiki) |

### Bucket Assignment

| Bucket | Score Range | Action |
|--------|-------------|--------|
| **Today** | ≥ 0.70 | Must respond today |
| **Tomorrow** | 0.40 – 0.69 | Respond within 48h |
| **This Week** | < 0.40 | Respond this week |

## Data Flow

```
Channel Adapters → Normalizer → Deduplicator → ScoreEngine → Queue
                                                                ↓
                                              Draft Engine ← Template Selector
                                                                ↓
                                              Review UI → Send/Log
```

## Plugin Architecture

Channel adapters implement the `ChannelAdapter` interface:

```typescript
interface ChannelAdapter {
  name: Channel;
  displayName: string;
  version: string;
  healthCheck(): Promise<AdapterHealthResult>;
  ingest(options: IngestOptions): Promise<NormalizedMessage[]>;
  send?(draft: DraftResponse): Promise<SendResult>;
}
```

Adapters are:
- **Self-contained** — each adapter handles its own auth and connection
- **Graceful** — failures return `{ status: 'unavailable', message: '...' }`
- **Testable** — mock adapters provided for unit testing
- **Pluggable** — register via config, not code changes

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Bun runtime | 3x faster, native TS, built-in test runner |
| Zod schemas | Runtime validation + static types from one source |
| SQLite (local-first) | Zero config, portable, no Docker needed |
| Monorepo with workspaces | Clean separation, independent versioning |
| MCP protocol | Standard for AI tool integration |
| Plugin adapters | Extensible without core changes |

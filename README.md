# CorrespondOS

> Multi-channel correspondence triage engine — ingest, deduplicate, score, and draft responses across email, CRM, and messaging platforms.

[![CI](https://github.com/jlynshue/correspond-os/actions/workflows/ci.yml/badge.svg)](https://github.com/jlynshue/correspond-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1+-black.svg)](https://bun.sh/)

---

## The Problem

Modern professionals manage correspondence across 8+ channels simultaneously — Outlook, Gmail, LinkedIn, Slack, HubSpot, Confluence, and more. Without a unified triage system:

- **Important messages get buried** under newsletters and notifications
- **Context is scattered** across systems with no single view
- **Response time suffers** because there's no priority ranking
- **Threads get dropped** when the same contact reaches out on multiple channels

## The Solution

CorrespondOS ingests messages from all your channels, normalizes them into a unified queue, scores them using a configurable weighted model, and presents a prioritized correspondence queue — so you always know what to respond to first.

```
┌─────────────────────────────────────────────────────────────────┐
│  Gmail → ┐                                                      │
│  Outlook → ┤  Normalize  →  Deduplicate  →  Score  →  Queue    │
│  LinkedIn → ┤                                                    │
│  HubSpot → ┤      ┌─────────────────────────────────┐          │
│  Slack → ───┘      │  Today (3) │ Tomorrow (5) │ ...│          │
│                     └─────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
bun add correspond-os

# Or run directly
bunx correspond-os triage
```

### From source

```bash
git clone https://github.com/jlynshue/correspond-os.git
cd correspond-os
bun install
bun run test
bun run cli -- triage
```

## Scoring Model

Every message is scored 0.0–1.0 using four weighted factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| **Revenue Impact** | 40% | Deal stage, pipeline value, fundraising signals |
| **Time Sensitivity** | 30% | Deadlines, urgency keywords, message age |
| **Relationship Tier** | 20% | CRM lifecycle (Customer > Opportunity > Lead) |
| **Channel Urgency** | 10% | Channel type + flags (DM > Email > Wiki) |

Messages are bucketed into:
- **Today** (≥ 0.70) — must respond today
- **Tomorrow** (0.40–0.69) — respond within 48h  
- **This Week** (< 0.40) — batch when convenient

Weights are fully configurable:

```typescript
import { ScoreEngine } from '@correspond-os/core';

const engine = new ScoreEngine({
  revenueImpact: 0.5,   // Heavy revenue focus
  timeSensitivity: 0.2,
  relationshipTier: 0.2,
  channelUrgency: 0.1,
});
```

## Architecture

```
packages/
├── shared/      # Zod schemas, types, constants, utilities
├── core/        # Scoring engine, normalizer, deduplicator (no I/O)
├── adapters/    # Channel plugins (Gmail, Outlook, HubSpot, LinkedIn...)
├── cli/         # Command-line interface
└── web/         # Optional web dashboard (React 19 + Hono)
```

Key design principles:
- **Local-first** — SQLite storage, no cloud dependency
- **Plugin architecture** — channel adapters are self-contained and swappable
- **Graceful degradation** — channels fail independently, system continues
- **Type-safe** — Zod schemas provide runtime validation + static types
- **MCP-native** — built for the [Model Context Protocol](https://modelcontextprotocol.io) ecosystem

## Channel Adapters

| Adapter | Protocol | Status |
|---------|----------|--------|
| Gmail | Google Workspace MCP | 🟢 Planned |
| Outlook | Microsoft Graph (Lokka MCP) | 🟢 Planned |
| HubSpot | HubSpot MCP | 🟢 Planned |
| LinkedIn | Browser automation (Playwright) | 🟡 Read-only |
| Slack | Slack MCP | 🟢 Planned |
| Confluence | Atlassian MCP | 🟢 Planned |
| Apollo.io | Apollo MCP | 🟢 Planned |
| GitHub | GitHub API | 🟢 Planned |

### Writing a custom adapter

```typescript
import type { ChannelAdapter } from '@correspond-os/shared';

export const myAdapter: ChannelAdapter = {
  name: 'custom',
  displayName: 'My Channel',
  version: '1.0.0',

  async healthCheck() {
    return { status: 'healthy', message: 'Connected', lastChecked: new Date() };
  },

  async ingest(options) {
    // Fetch messages from your channel
    return [/* NormalizedMessage[] */];
  },

  async send(draft) {
    // Optional: send a drafted response
    return { success: true, channel: 'custom', sentAt: new Date() };
  },
};
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run tests with coverage
bun run test:ci

# Lint
bun run lint

# Type check
bun run typecheck

# Build all packages
bun run build

# Run harness validation
bun run packages/core/src/harness/validate.ts
```

### Harness-Driven Development

This project uses a **harness-based development loop** — criteria are defined upfront and the development cycle repeats until all are met. See [docs/HARNESS.md](docs/HARNESS.md) for details.

```bash
# Check current harness status
bun run packages/core/src/harness/validate.ts

# Generate evidence report
bun run packages/core/src/harness/report.ts
```

## Roadmap

- [x] Core scoring engine with 4-factor model
- [x] Normalizer + Deduplicator
- [x] Harness-driven CI/CD pipeline
- [ ] Gmail adapter (MCP)
- [ ] Outlook adapter (Lokka MCP)
- [ ] CLI interface (`correspond triage`)
- [ ] SQLite persistence layer
- [ ] Web dashboard (React 19 + Hono)
- [ ] Template engine for response drafting
- [ ] npm package publication

## Contributing

This project is in early development. Contributions welcome once v0.1.0 stabilizes.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write tests for your changes
4. Ensure `bun run test && bun run lint` passes
5. Submit a PR

## License

[MIT](LICENSE) © Jonathan Lyn-Shue

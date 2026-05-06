# Harness-Driven Development Loop

## Overview

CorrespondOS uses a **harness-based continuous development workflow** that iterates until all criteria are satisfied. The harness ensures:

- ✅ All functional requirements are implemented and tested
- 📝 Every decision is documented with rationale
- 🧪 Test evidence is collected at each iteration
- 🔄 The loop repeats until exit criteria are met
- 🚀 CI/CD validates the harness on every push

## Loop Diagram

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   ┌──────────┐    ┌──────────┐    ┌──────────────┐       │
│   │  DEVELOP │───▶│   TEST   │───▶│   VALIDATE   │       │
│   └──────────┘    └──────────┘    └──────┬───────┘       │
│        ▲                                  │               │
│        │           ┌──────────┐           │               │
│        │           │ DOCUMENT │◀──────────┤               │
│        │           └────┬─────┘           │               │
│        │                │                 ▼               │
│        │                │          ┌─────────────┐        │
│        └────────────────┘◀─────────│ ALL MET?    │        │
│         (criteria unmet)           │  (harness)  │        │
│                                    └──────┬──────┘        │
│                                           │ YES           │
│                                           ▼               │
│                                    ┌─────────────┐        │
│                                    │  COMPLETE   │        │
│                                    └─────────────┘        │
└────────────────────────────────────────────────────────────┘
```

## Criteria Categories

| Category | What's Checked | Exit Condition |
|----------|---------------|----------------|
| **Functional** | Core modules exist and export correctly | All modules implemented |
| **Testing** | Unit tests pass with coverage | Tests exist and pass |
| **Documentation** | README, architecture, decisions documented | All docs present |
| **Quality** | Linter passes, types check, no errors | Zero lint/type errors |
| **Performance** | Scoring engine handles 1000 items in <100ms | Benchmark passes |

## Running the Harness

```bash
# Validate all criteria
bun run packages/core/src/harness/validate.ts

# Generate evidence report
bun run packages/core/src/harness/report.ts

# Full CI check (lint + typecheck + test + build + harness)
bun run test:ci && bun run packages/core/src/harness/validate.ts
```

## CI Integration

The harness runs automatically on every push via `.github/workflows/ci.yml`:

1. **quality** job: lint → typecheck → test → build
2. **harness-check** job: validate criteria → generate report → upload artifacts

Evidence reports are uploaded as GitHub Actions artifacts (retained 30 days).

## Decision Log Format

Every significant decision is recorded:

```typescript
{
  id: "dec-001",
  title: "Use Bun as runtime",
  context: "Need fast TS execution, built-in test runner, npm-compatible",
  decision: "Use Bun 1.1+ as primary runtime",
  rationale: "3x faster than Node, native TS, built-in test runner reduces deps",
  alternatives: ["Node.js + tsx", "Deno", "Node.js + vitest"],
  madeBy: "Jon",
  madeAt: "2026-05-06"
}
```

## Evidence Types

| Type | Description | Example |
|------|-------------|---------|
| `test-result` | Unit/integration test output | "8 tests passed, 0 failed" |
| `coverage` | Code coverage report | "92% line coverage" |
| `benchmark` | Performance measurement | "1000 items scored in 12ms" |
| `review` | Code review or architecture review | PR #3 approved |
| `log` | Build/CI log | "Build succeeded in 2.1s" |

## Breadcrumbs

Each iteration leaves breadcrumbs in `.harness/evidence/`:

```
.harness/
├── evidence/
│   ├── report-2026-05-06.md      # Daily evidence report
│   ├── report-2026-05-07.md
│   └── ...
└── state.json                     # Current harness state (gitignored)
```

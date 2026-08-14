# Repo Automation Score backend

Express + TypeScript + Kysely/SQLite localhost service for repository discovery, agent execution, evaluation, and report persistence.

## Documentation

| Area | Canonical document |
|---|---|
| Backend architecture | [`../docs/architecture/backend.md`](../docs/architecture/backend.md) |
| Database and migrations | [`../docs/architecture/database.md`](../docs/architecture/database.md) |
| Providers and execution | [`../docs/architecture/providers-and-execution.md`](../docs/architecture/providers-and-execution.md) |
| Evidence and reports | [`../docs/architecture/evidence-and-reports.md`](../docs/architecture/evidence-and-reports.md) |
| Development handbook | [`../docs/development/README.md`](../docs/development/README.md) |
| Local development | [`../docs/operations/local-development.md`](../docs/operations/local-development.md) |
| Testing | [`../docs/operations/testing.md`](../docs/operations/testing.md) |

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 22+ |
| Framework | Express 5 |
| Language | TypeScript 5.9 |
| Database | SQLite with Kysely and better-sqlite3 |
| Tests | Node test runner |

## Module ownership

| Path | Responsibility |
|---|---|
| `src/http/app.ts` | Injectable Express application and API boundary |
| `src/benchmark-web-server.ts` | Loopback listener |
| `src/benchmark-web-lib.ts` | Repository discovery, prompt composition, and web-run orchestration |
| `src/run-agent-benchmark.ts` | Scenario matrix and isolated candidate execution |
| `src/grade-agent-benchmark.ts` | Evaluation and implementation review |
| `src/services/run-persistence.ts` | Run lifecycle persistence, legacy import, and report projections |
| `src/db/` | SQLite client, configuration, types, and migration runtime |
| `db/migrations/` | Forward-only schema migrations |
| `db/scripts/` | Migration status and legacy import commands |

## Local API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/providers` | List available provider models and options |
| `GET` | `/api/runs` | List persisted runs and report projections |
| `GET` | `/api/runs/:id` | Read one run |
| `POST` | `/api/runs` | Validate and start a run |
| `POST` | `/api/repository` | Validate guidance and discover repository skills |
| `POST` | `/api/pick-directory` | Open the supported native directory picker |

Routes in `src/http/app.ts` remain the source of truth. The service is designed for loopback use and has no remote-user authentication boundary.

Run `npm test` and `npm run backend:check` after backend changes.

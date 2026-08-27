# Agent Insights

Local-first application for measuring how efficiently agentic platforms execute and verify workflows. Observe real sessions without rerunning them, or use isolated repository benchmarks for controlled A/B testing.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS |
| Backend | Express 5, TypeScript |
| Database | SQLite, Kysely, better-sqlite3 |
| Agent execution | Provider-neutral; Codex is the first provider |
| Isolation | Git worktrees and optional Docker Compose |
| CI | GitHub Actions |

## Docs

| Area | Documentation |
|---|---|
| Architecture | [docs/architecture/README.md](docs/architecture/README.md) |
| Product features | [docs/features/README.md](docs/features/README.md) |
| Frontend | [frontend/README.md](frontend/README.md) |
| Backend and API | [backend/README.md](backend/README.md) |
| Development handbook | [docs/development/README.md](docs/development/README.md) |
| Repository workflows | [docs/workflows/README.md](docs/workflows/README.md) |
| Benchmark definitions | [benchmarks/README.md](benchmarks/README.md) |

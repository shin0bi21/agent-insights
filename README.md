# Repo Automation Score

Local-first application for measuring how reliably agentic coding platforms can understand, change, and verify a repository.

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
| Setup and operations | [docs/operations/README.md](docs/operations/README.md) |
| Benchmark definitions | [benchmarks/README.md](benchmarks/README.md) |

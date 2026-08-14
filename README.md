# Repo Automation Score

Repo Automation Score is a local-first application for measuring how reliably agentic coding platforms can understand, change, and verify a repository. It combines repository-readiness checks, isolated empirical runs, normalized execution evidence, deterministic evaluation, and actionable reports without modifying the attached working tree.

## Stack

| Boundary | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7 |
| Local API | Express 5, TypeScript |
| Persistence | SQLite, Kysely, better-sqlite3 |
| Agent execution | Provider-neutral contract; Codex is the first provider |
| Isolation | Detached Git worktrees and optional scenario-owned Docker Compose |
| Local packaging | Native Node.js or Docker Compose |
| Verification | Node test runner, Vitest, TypeScript, GitHub Actions |

## Quick start

Requirements are Node.js 22 or newer, Git, and authentication for the agent provider you intend to use.

```bash
npm install
npm run db:migrate
npm run web:dev
```

Open the Vite URL printed by the process, normally `http://127.0.0.1:5173`. The production-style local build is available with `npm run web` at `http://127.0.0.1:4173`.

The service binds to loopback and runs with the terminal user's permissions. Durable run evidence is stored in the Git-ignored local SQLite database. Absolute repository and worktree paths are never stored; an active run may expose them transiently to the loopback UI for local job inspection. Raw provider output and runner files are deleted after successful normalization.

Docker is an optional supported startup path for a consistent application runtime. It still requires an explicitly mounted target repository and provider authentication; scenarios that launch Docker require the separate, privileged runner override. See [Docker development](docs/development/stack/docker.md).

## Documentation

| Area | Canonical documentation |
|---|---|
| Documentation map | [docs/README.md](docs/README.md) |
| Architecture | [docs/architecture/README.md](docs/architecture/README.md) |
| Product features | [docs/features/README.md](docs/features/README.md) |
| Development handbook | [docs/development/README.md](docs/development/README.md) |
| Operations | [docs/operations/README.md](docs/operations/README.md) |
| Backend and API | [backend/README.md](backend/README.md) |
| Frontend | [frontend/README.md](frontend/README.md) |
| Benchmark scenarios | [scenarios/README.md](scenarios/README.md) |

The current executable `tasks-page` scenario remains pinned to `my-webapp`; it is an experiment fixture, not a generic structural requirement. See [Running benchmarks](docs/operations/running-benchmarks.md) before spending provider tokens.

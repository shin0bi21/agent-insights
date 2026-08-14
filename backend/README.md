# Backend

The backend is the privileged localhost application layer. It owns repository validation and discovery, native folder selection, provider execution, Git worktree isolation, run artifacts, evaluators, and report data. It currently persists runs as auditable files under `results/`; no database is required for the present lifecycle.

`src/benchmark-web-server.ts` exposes the loopback API. `src/benchmark-web-lib.ts` owns repository and run-management behavior. The benchmark runner and evaluator remain separate modules so future providers and scenario templates can reuse them.

Run `npm test` and `npm run backend:check` after backend changes.

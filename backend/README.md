# Backend

The backend is the privileged localhost application layer. It owns repository validation and discovery, native folder selection, provider execution, Git worktree isolation, run artifacts, evaluators, and report data. It currently persists runs as auditable files under `results/`; no database is required for the present lifecycle.

`src/benchmark-web-server.mjs` exposes the loopback API. `src/benchmark-web-lib.mjs` owns repository and run-management behavior. The benchmark runner and evaluator remain separate modules so future providers and scenario templates can reuse them.

Run `npm test` and applicable `node --check` commands after backend changes.

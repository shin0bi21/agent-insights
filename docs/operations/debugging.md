# Debugging

## Browser and API

- Confirm the printed Vite and API URLs; do not assume a preferred port when it was already occupied.
- Check `/api/providers` and `/api/runs` directly to separate API state from browser rendering.
- A refused connection means no listener is available at that address; identify stale or conflicting processes before restarting.
- Express returns JSON for API validation and not-found failures. Inspect the response before treating a frontend error as a provider failure.

## Database

- Run `npm run db:status` before debugging missing history.
- Inspect the ignored SQLite database selected by `REPO_AUTOMATION_SCORE_DB_PATH` or the default `data/` path.
- Use `PRAGMA foreign_key_check` after relationship changes.
- Compare `runs`, `run_attempts`, `run_passes`, evaluations, and summary views when a report projection looks incomplete.

## Agent runs

- Separate repository validation, provider availability, worktree preparation, agent execution, repository checks, evaluation, and normalization.
- Bounded live activity is user-facing progress; it is not private reasoning and may omit raw diagnostic detail.
- Repeated provider state-database warnings can be non-fatal. Process exit, timeout, missing output, evaluator failure, and normalization failure determine the run outcome.
- Failed patch applications are execution findings, not proof the whole run failed; inspect whether the agent recovered and whether final checks passed.
- When normalization fails, the backend retains the temporary directory and logs its exact path. Successful runs intentionally have no raw artifact directory.

Never paste credentials, full private repository contents, or hidden reasoning into an issue or report.

# Database and migrations

SQLite is the durable local source of truth for run history and reports. Kysely provides typed queries; migrations remain plain forward-only SQL.

## Storage boundary

The default database is `data/agent-automation-score.sqlite`, which is ignored by Git. `AGENT_AUTOMATION_SCORE_DB_PATH` may point tests or packaged builds at another local file. Renamed installations continue using an existing `data/repo-automation-score.sqlite` when the new file is absent; `REPO_AUTOMATION_SCORE_DB_PATH` remains a deprecated compatibility alias so local history is not orphaned.

The database stores repository names and Git revisions, never absolute repository paths. It stores prepared prompts and normalized evidence, not byte-for-byte provider transcripts or private chain-of-thought.

## Schema ownership

| Tables | Responsibility |
|---|---|
| `runs`, `run_agent_setup` | Request, repository revision, provider configuration, status, and timestamps |
| `run_attempts` | Independent repetitions or retries |
| `run_passes` | Initial work and ordered review loops within an attempt |
| `pass_token_usage`, `pass_phases`, `pass_events` | Usage and bounded execution history |
| `pass_checks`, `pass_changes` | Verification and changed-file evidence |
| `pass_evaluations` | Score at a specific pass |
| `structural_findings`, `implementation_findings`, `execution_findings` | What was missing, built, or inefficient |
| `run_recommendations` | Evidence-linked documentation, skill, workflow, testing, or architecture improvements |
| `attempt_summary`, `run_summary` | Read models for reports and comparisons |

## Migration contract

Migration files live under `backend/db/migrations/` and use `YYYY-MM-DD_#_description.sql`. They run in lexical order and are tracked in `schema_migrations` with a SHA-256 checksum.

- Never edit or rename a migration after it has been applied outside a confirmed disposable local database.
- Encode stable invariants with foreign keys, unique constraints, checks, and indexes.
- Preserve history deliberately when choosing cascade or deletion behavior.
- Keep each migration transactionally complete and add a new forward migration for later corrections.
- Update `backend/src/db/database.ts` when the typed schema changes; use `npm run db:types` only when the generator is configured against the intended database.

## Commands

```bash
npm run db:migrate
npm run db:status
npm run db:import-results
```

The legacy importer is idempotent by run ID. Verify run, pass, prompt, usage, evaluation, and finding counts before deleting legacy input. Database files, WAL files, and generated run data must remain ignored and untracked.

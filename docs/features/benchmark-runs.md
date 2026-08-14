# Benchmark runs

## Configuration

A run combines a repository revision, frontend/backend/full-stack scope, prepared prompt, provider and model setup, isolation policy, evaluator version, and optional template or reference. The user selects scope and describes the feature; the target repository's `AGENTS.md` owns workflow and skill routing.

The Home view contains the setup workflow and exactly one current card: the newest run. History contains every run, including that newest run, so it remains a complete archive.

## Lifecycle and isolation

Runs move through queued, preparing, running, evaluating, and a terminal completed, failed, cancelled, timed-out, or interrupted state. Candidate work executes in a detached disposable worktree and never in the attached working tree.

During execution, the API converts provider events into bounded agent updates, commands, file changes, checks, errors, retries, and completion. It must not present or retain private chain-of-thought. Live activity stays inside a keyboard-focusable bounded scroll region.

## Persistence and privacy

SQLite stores repository name and revisions, configuration, prepared prompt, usage, phases, bounded events, checks, changed-file evidence, evaluations, findings, and recommendations. Absolute repository and worktree paths are never durable; active job configuration may show them transiently through the loopback UI. Raw provider output, terminal logs, and patches are temporary and are removed after successful normalization.

A future remote runner or synchronization feature must require explicit opt-in and define transferred fields, authorization, retention, and deletion before implementation.

## Attempts, repetitions, and review passes

An attempt is one independent candidate execution. Repetitions create attempts for reliability measurement. A review loop creates an ordered pass inside the same attempt so the report can show quality and token usage by pass. Retrying an unsuccessful run creates a new run from the same visible configuration; it does not overwrite prior evidence.

## Retry and interruption

Failed, timed-out, cancelled, and interrupted cards expose Retry Run. Active process-local runs may reuse their connected repository path. Historical records do not persist that path, so the user must reconnect the repository before retrying after a restart or from durable history. Retry remains disabled while another run is active.

## Run presentation

Active and unsuccessful runs may expose transient job configuration and diagnostics. Completed runs omit duplicate job configuration because their report includes provider, model, reasoning, score, time, usage, findings, and implementation evidence. Completed state uses text and a successful visual treatment.

Anchored menus choose upward or downward placement from viewport space and close when their scroll context moves. Centered report dialogs lock background scrolling and keep their own overflow usable.

## Implementation ownership

- Browser workflow: `frontend/src/App.tsx`
- Typed transport: `frontend/src/api.ts`, `frontend/src/types.ts`
- Express boundary: `backend/src/http/app.ts`
- Run orchestration: `backend/src/benchmark-web-lib.ts`, `backend/src/run-agent-benchmark.ts`
- Persistence: `backend/src/services/run-persistence.ts`
- Database: `backend/db/`, `backend/src/db/`

## Changing this feature

Start with [Adding a feature](../development/adding-a-feature.md) or [Updating a feature](../development/updating-a-feature.md), then use the run-persistence and frontend-workflow guides as applicable.

# Session monitoring

Session monitoring observes agent work that the user is already performing. It does not create a benchmark candidate or spend model tokens merely to calculate metrics. Codex is the first session source; platform-specific transports stay behind a normalized session-source boundary.

The first web workflow initializes Codex App Server and lists stored sessions without starting a turn. A versioned, read-only Codex local-state adapter follows parent/child worker relationships and extracts current token usage from each rollout. Session Review has one selector and one dashboard: Start watching refreshes directive episodes, context usage, changes, searches, compactions, delegation, verification, and model usage once per second, then scrolls the first snapshot into view; Generate static review renders the normalized durable import returned by SQLite in that same dashboard. It never retains message text or private reasoning. A deeper report and PDF view are separate future presentation layers over the stored structured data.

`npm start` is the canonical host-session runtime. Its preflight resolves the same `CODEX_HOME` used by the desktop Codex application and reports the available session count before starting the web service. Docker intentionally uses an isolated provider volume and never mounts the host Codex home, which contains credentials and private session data.

Rollout parsing is incremental. Each resolved regular file has a cached byte cursor and aggregate state; unchanged files do no parsing, appended files process only new complete JSON lines, and truncation or inode rotation resets the bounded scan. Concurrent reads of one rollout share a scan. Initial scans above the safety limit and worker graphs above the bounded limit fail closed.

Live session usage presents one compact input-token headline and cache-hit rate for the Main Agent and Subagents totals. Expanding a total separates each model-and-reasoning aggregate into cached input, new input, and output; individual worker rows and identities are not presented. Large values use compact notation so cache efficiency and context pressure remain scannable.

The primary dashboard does not present raw tool-call counts or automation-offload estimates as quality measures. Tool calls are provider wrappers around shell, patch, search, delegation, and other capabilities; a wrapper may contain more than one underlying operation, so its count does not establish useful work. Experimental content-free process telemetry remains normalized for future directive-level diagnostics but is not shown as a session-review result.

Process telemetry is diagnostic rather than evaluative. Reading or changing a workflow may require repository context and model judgment, while status polling, log filtering, and reruns may later support a directive-level efficiency finding. No process category currently changes a session score.

Live scores are provisional and must include telemetry coverage. A final score is calculated when the observed session reaches a terminal state. Missing historical telemetry is unknown, never zero. Controlled worktree benchmarks remain a separate Lab workflow for reproducible A/B comparisons.

Live presentation and durable evidence have separate update cadences. The service updates an in-memory snapshot for the renderer, coalescing routine UI notifications to roughly once per second. Lifecycle boundaries such as turn completion, failure, interruption, compaction, and final usage flush immediately. Routine events and usage snapshots are committed to SQLite in bounded transactions every few seconds or when the buffer reaches its size limit. Idle means no turn is active; it flushes buffered evidence but does not finalize the session.

Every live snapshot exposes both an observed event watermark and a durable watermark. Reconnection loads evidence through the durable watermark and overlays newer in-memory events. Source-stable event keys make overlapping replay idempotent. Raw transcripts, terminal streams, absolute repository paths, credentials, and private reasoning are never durable session evidence.

Root-chat user messages are transiently classified as directive, mixed question/directive, question, correction, approval, or context. Every user-message interval is considered as a candidate, but only an interval with an observed repository change becomes a directive episode. Questions, discussion, approvals, corrections, and explicit preparation instructions without a change remain session context and contribute content-free preparation and pattern-discovery evidence to the next change-backed episode. This keeps the review unit aligned with the sandbox's one-change-directive unit without discarding useful lead-in context. The classifier is heuristic, versioned, and confidence-labelled. It does not return or persist message text.

Each prompt boundary records cumulative context-window and token-usage counters, including cached input, so later reports can chart context pressure and cache behavior over time without retaining prompt text. Each change-backed directive episode records its opening prompt snapshot, peak context, preparation counts, prior and in-episode AGENTS.md/skill-pattern discovery, discovery latency, whether a pattern was observed before the first change, and bounded execution totals for changes, searches, delegations, compactions, and verification batches. These are diagnostic measurements rather than performance scores. The initial adapter attributes only root-rollout activity; subagent work and semantic adherence remain unavailable until provider-neutral episode linkage and evaluators are added.

The persistence foundation does not yet define live or final scoring. Context health, verification confidence, pattern discoverability, implementation alignment, and claim support require separately versioned evaluators after real telemetry coverage is established.

## Implementation ownership

- Session-source adapter: `backend/src/services/codex-session-source.ts`
- Read-only worker usage adapter: `backend/src/services/codex-local-session-store.ts`
- Live-state and durable batching: `backend/src/services/session-persistence.ts`
- Stored-session import and review projection: `backend/src/services/session-manager.ts`
- Session schema: `backend/db/migrations/2026-08-18_1_add_session_monitoring.sql`
- Offload summary schema: `backend/db/migrations/2026-08-20_1_add_session_offload_summary.sql`
- Normalized process schema: `backend/db/migrations/2026-08-21_1_add_session_offload_processes.sql`
- Directive episode schema: `backend/db/migrations/2026-08-22_1_add_session_directive_episodes.sql`
- Prompt telemetry snapshots: `backend/db/migrations/2026-08-23_1_add_session_prompt_snapshots.sql`
- Local API boundary: `backend/src/http/app.ts`
- Session Review: `frontend/src/pages/Sessions/`
- Connection status: `frontend/src/pages/Settings/`

## Current limitation

The product has two measurement modes: Session Review for real sessions and Benchmark Lab for controlled sandbox comparisons. Session Review's watcher defaults to sessions observed within five minutes and can widen to the last hour or 24 hours; older saved/importable history remains in its review area. Every recent result shows its relative activity time. Usage is presented as one Main agent total and one Subagents total; each can expand into its model-and-reasoning breakdown instead of exposing every subagent row by default. Worker date ranges show each matching group's current cumulative processed-token total, not historical token deltas. Live polling is not yet connected to the durable batching layer event-by-event. Historical imports do not currently recover complete command/check details, timestamps for every item, or file-level changes. Static reviews created before directive episodes were introduced show that evidence as unavailable until regenerated from a local rollout. Directive classification does not establish semantic adherence, related-topic linkage, or causation between context/delegation and outcome. Codex's local schema and generated app-server schema are internal compatibility boundaries, so adapters validate expected tables and paths and fail closed when they change. Session deletion, direct control-socket streaming, subagent-to-directive attribution, semantic directive evaluators, periodic usage history, and versioned session scores remain follow-up features.

## Changing this feature

Use [Adding a feature](../development/adding-a-feature.md) and the provider/execution architecture contract.

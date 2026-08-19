# Session monitoring

Session monitoring observes agent work that the user is already performing. It does not create a benchmark candidate or spend model tokens merely to calculate metrics. Codex is the first session source; platform-specific transports stay behind a normalized session-source boundary.

The first web workflow initializes Codex App Server and lists stored sessions without starting a turn. A versioned, read-only Codex local-state adapter follows parent/child worker relationships and extracts current token usage from each rollout. Session Review has one selector and one dashboard: Start watching refreshes normalized context usage, turns, tool calls, file changes, web searches, compactions, delegation, and model usage once per second, then scrolls the first snapshot into view; Generate static review renders the normalized durable import returned by SQLite in that same dashboard. It never retains message text or private reasoning. A deeper report and PDF view are separate future presentation layers over the stored structured data.

Rollout parsing is incremental. Each resolved regular file has a cached byte cursor and aggregate state; unchanged files do no parsing, appended files process only new complete JSON lines, and truncation or inode rotation resets the bounded scan. Concurrent reads of one rollout share a scan. Initial scans above the safety limit and worker graphs above the bounded limit fail closed.

Live session usage includes input, cached input, uncached input, output, and cache-hit rate for the Main Agent and Subagents totals. Expanding a total shows both model-and-reasoning aggregates and safe per-agent rows; agent nicknames or roles are preferred, with ordinal fallback labels instead of raw thread IDs. Aggregate cache-hit rate appears beside context-window usage so cache efficiency and context pressure can be watched together.

Live scores are provisional and must include telemetry coverage. A final score is calculated when the observed session reaches a terminal state. Missing historical telemetry is unknown, never zero. Controlled worktree benchmarks remain a separate Lab workflow for reproducible A/B comparisons.

Live presentation and durable evidence have separate update cadences. The service updates an in-memory snapshot for the renderer, coalescing routine UI notifications to roughly once per second. Lifecycle boundaries such as turn completion, failure, interruption, compaction, and final usage flush immediately. Routine events and usage snapshots are committed to SQLite in bounded transactions every few seconds or when the buffer reaches its size limit. Idle means no turn is active; it flushes buffered evidence but does not finalize the session.

Every live snapshot exposes both an observed event watermark and a durable watermark. Reconnection loads evidence through the durable watermark and overlays newer in-memory events. Source-stable event keys make overlapping replay idempotent. Raw transcripts, terminal streams, absolute repository paths, credentials, and private reasoning are never durable session evidence.

The live dashboard also reports heuristic guidance-path coverage: AGENTS.md path references, skill-instruction path references, the skill names referenced, prompt-to-first-skill-reference latency, and whether a skill path reference was observed after the latest prompt. Prompt content is inspected transiently only to establish event timing and is never returned or persisted. These labels do not claim that a file was semantically read or applied; this is an operational coverage signal, not yet a semantic score of whether the correct skill matched the request.

The persistence foundation does not yet define live or final scoring. Context health, verification confidence, pattern discoverability, implementation alignment, and claim support require separately versioned evaluators after real telemetry coverage is established.

## Implementation ownership

- Session-source adapter: `backend/src/services/codex-session-source.ts`
- Read-only worker usage adapter: `backend/src/services/codex-local-session-store.ts`
- Live-state and durable batching: `backend/src/services/session-persistence.ts`
- Stored-session import and review projection: `backend/src/services/session-manager.ts`
- Session schema: `backend/db/migrations/2026-08-18_1_add_session_monitoring.sql`
- Local API boundary: `backend/src/http/app.ts`
- Session Review: `frontend/src/pages/Sessions/`
- Connection status: `frontend/src/pages/Settings/`

## Current limitation

The product has two measurement modes: Session Review for real sessions and Benchmark Lab for controlled sandbox comparisons. Session Review's watcher defaults to sessions observed within five minutes and can widen to the last hour or 24 hours; older saved/importable history remains in its review area. Every recent result shows its relative activity time. Usage is presented as one Main agent total and one Subagents total; each can expand into its model-and-reasoning breakdown instead of exposing every subagent row by default. Worker date ranges show each matching group's current cumulative processed-token total, not historical token deltas. Live polling is not yet connected to the durable batching layer event-by-event. Historical imports do not currently recover command/check details, timestamps for individual items, or file-level change details. Codex's local schema and generated app-server schema are internal compatibility boundaries, so adapters validate expected tables and paths and fail closed when they change. Session deletion, direct control-socket streaming, periodic usage history, and versioned session scores remain follow-up features.

## Changing this feature

Use [Adding a feature](../development/adding-a-feature.md) and the provider/execution architecture contract.

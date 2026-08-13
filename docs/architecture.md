# Architecture

Repo Automation Score is a local-first web application. The browser owns configuration and result presentation; a localhost service owns privileged access to repositories, agent CLIs, Git worktrees, tests, and artifacts.

## Boundaries

```text
Browser UI
  → local HTTP API
    → provider adapter
      → isolated Git worktree
        → target repository tools and tests
    → normalized run artifacts
      → comparison and report generation
```

The browser never executes repository commands. The local service binds to `127.0.0.1`, validates repository paths and run configuration, and records every prepared prompt and result under the run artifact directory.

## Agent providers

Repository discovery, skill selection, feature prompts, run state, normalized events, comparisons, and reports are provider-neutral. A provider adapter owns platform-specific concerns:

- authentication and CLI or API availability;
- model and reasoning-option discovery;
- command construction and permissions;
- event, token, timing, and final-message normalization;
- cancellation and failure classification.

Codex is the first provider. Luna and Terra are models exposed by that adapter, not concepts embedded in the product model. Adding another agentic platform should require a provider adapter and contract tests, without changing repository discovery or reporting.

## Repository and scenario model

A repository connection discovers `AGENTS.md` and skills beneath `.agents/skills` or `.codex/skills`. A run combines a repository revision, selected skill, user feature description, provider configuration, isolation policy, and evaluator.

The current executable scenario is `tasks-page`, pinned to historical and guidance revisions in `my-webapp`. Supporting arbitrary repositories requires a scenario builder that captures:

- the implementation baseline;
- an optional reference implementation revision or directory;
- guidance paths and their revision;
- repository-owned checks;
- structural and behavioral comparison contracts.

Reference comparison should be contract-aware. Exact paths matter for repository-mandated owners such as routes, controllers, policies, and services. Frontend composition should be compared structurally and behaviorally rather than requiring a byte-for-byte directory clone.

## Reports

Run output is normalized to structured JSON before presentation. HTML and future PDF exports are views of that data. Reports should identify missing contracts, failed checks, meaningful reference differences, likely documentation gaps, and potential skill or sub-agent improvements while separating evidence from recommendations.

## Desktop packaging

The web UI and local API remain the primary architecture. A future Tauri application can wrap them to provide native folder selection, lifecycle management, and distribution without replacing the interface or provider contracts.

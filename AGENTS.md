# Agent instructions

## Start here

- Treat this repository as the workspace boundary and do not inspect target repositories unless the task names or authorizes them.
- Use `.agents/skills/develop-feature/` for product and application changes.
- Use `.agents/skills/maintain-evaluators/` for scenarios, scoring, comparison, report evidence, and automation-readiness changes.
- Before deep review or shipping, use `.agents/skills/split-changes/` to decide whether the diff is one concern or produce the authoritative concern map.
- Use `.agents/skills/review-changes/` for repeatable concern-level review and `.agents/skills/ship-changes/` for issue, branch, verification, pull-request, check, and merge workflows.
- Follow `split decision → concern review → serial shipping to main`. Deployment and package publication always require separate explicit authorization.
- Read the applicable contract under `docs/features/` before changing established behavior.
- Read `docs/architecture.md` before changing service boundaries, provider adapters, repository execution, artifacts, or reports.
- Read `docs/operations/local-development.md` before running the web service or an actual agent benchmark.

## Product invariants

- Keep repository discovery, skills, run state, normalized evidence, and reports agent-platform-neutral.
- Put agent-specific authentication, models, command construction, events, usage, cancellation, and errors behind a provider adapter.
- Never require target repositories to copy this repository's documentation or folder structure.
- Separate universal automation-readiness evidence from template- or scenario-specific expectations.
- Never execute candidate work in the attached repository's working tree; use a pinned revision and isolated worktree.
- Preserve raw prompts, events, patches, checks, timing, usage, and evaluator output so reports remain auditable.
- Bind the local service to loopback by default and validate all repository and artifact paths at the server boundary.
- Treat PDF as a view of structured report data, not the report's source of truth.

## Verification

- Run `npm test` for JavaScript, runner, evaluator, provider, or discovery changes.
- Run `node --check backend/src/benchmark-web-server.mjs`, `npm run web:check`, and `npm run test:web` for server or frontend changes.
- Validate changed skills with the skill validator named in `.agents/skills/develop-feature/SKILL.md`.
- Use a dry run before spending agent tokens on a changed scenario or matrix.
- Do not claim an agent, check, or template works unless that exact path was exercised.

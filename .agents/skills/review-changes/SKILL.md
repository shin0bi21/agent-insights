---
name: review-changes
description: Review tracked and untracked Repo Automation Score changes for correctness, security, provider neutrality, path and subprocess safety, evaluator validity, accessibility, evidence integrity, tests, and consistency with repository contracts. Use when asked to review, audit, inspect, or assess current changes before fixing or shipping them.
---

# Review Changes

Review without editing, creating issues or branches, committing, or making remote changes. A clean review does not authorize shipping.

For multiple substantial concerns, delegate independent read-only review lanes to lower-cost workers at low reasoning while the strongest primary orchestrator owns severity, deduplication, cross-boundary analysis, and the final report. Escalate only lanes with demonstrated architectural, security, concurrency, or debugging complexity. Do not delegate a small or tightly coupled review, and verify worker findings before reporting them.

1. Reuse the current `split-changes` concern map. If a large or mixed diff has no map, run the split workflow before deep review. Inspect the complete diff and map changed files to contracts under `docs/features/`, `docs/architecture.md`, and `AGENTS.md`.
2. Review privileged boundaries first: repository path containment, loopback exposure, subprocess arguments, credentials, worktree isolation, cancellation, and cleanup.
3. Check that provider-specific behavior does not leak into provider-neutral UI, run, comparison, or report models.
4. For evaluators, check applicability, version compatibility, deterministic evidence, weights, false positives, and separation of repository, agent, evaluator, and environment failures.
5. For UI changes, check semantic HTML, keyboard use, live status, failure recovery, narrow layouts, and reduced motion.
6. Inspect tests and reuse exact, current verification evidence. Run only missing or stale narrow checks. Do not edit unless the user asks for fixes.
7. Check that ignored local run data, prompts, patches, paths, credentials, and databases cannot enter Git or remote storage.
8. Report findings by severity with file and line evidence, then list test gaps, concern boundaries, and residual risks. State clearly when no findings remain. A clean review does not authorize shipping.

Reuse focused checks when they cover the exact unchanged concern diff. If a finding is fixed or the concern materially changes, review that current state rather than repeating stale conclusions.

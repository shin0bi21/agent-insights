---
name: review-changes
description: Review tracked and untracked Agent Benchmark Workbench changes for correctness, security, provider neutrality, path and subprocess safety, evaluator validity, accessibility, evidence integrity, tests, and consistency with repository contracts. Use when asked to review, audit, inspect, or assess current changes before fixing or shipping them.
---

# Review Changes

1. Inspect the complete diff and map changed files to contracts under `docs/features/`, `docs/architecture.md`, and `AGENTS.md`.
2. Review privileged boundaries first: repository path containment, loopback exposure, subprocess arguments, credentials, worktree isolation, cancellation, and cleanup.
3. Check that provider-specific behavior does not leak into provider-neutral UI, run, comparison, or report models.
4. For evaluators, check applicability, version compatibility, deterministic evidence, weights, false positives, and separation of repository, agent, evaluator, and environment failures.
5. For UI changes, check semantic HTML, keyboard use, live status, failure recovery, narrow layouts, and reduced motion.
6. Inspect tests and run the narrow authoritative checks. Do not edit unless the user asks for fixes.
7. Report findings by severity with file and line evidence, then list test gaps and residual risks. State clearly when no findings remain.

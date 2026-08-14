---
name: split-changes
description: Make the top-level split decision for Repo Automation Score working-tree changes before deep review, repeated verification, commits, or pull requests. Use when asked to split or separate work and before reviewing or shipping a large or mixed diff; confirm a genuinely cohesive change without manufacturing tiny groups.
---

# Split Changes

Make one read-only concern map. Do not edit, test, stash, commit, or make remote changes.

When delegation and tier selection are available, assign this complete read-only workflow to one lower-cost worker at low reasoning. Do not use multiple split workers. Keep the primary orchestrator on the strongest available tier to verify the returned map against the complete inventory and own downstream decisions. If delegation is unavailable, run it directly.

1. Inspect branch status and every tracked and untracked path. Distinguish intentional source changes from ignored run artifacts and generated frontend output.
2. Group independently reviewable and shippable behavior, not directories. Keep one feature's frontend, backend, tests, contracts, and documentation together when they implement one outcome.
3. Separate provider adapters, evaluator methodology, product features, workflow tooling, and unrelated fixes when they can ship independently. Record dependencies and hunk-level ownership where concerns share files.
4. For each concern record its acceptance scope, exact paths or hunks, dependencies, authoritative checks, unresolved questions, and work that must remain local or uncommitted.
5. Order concerns safely. Shared foundations precede consumers; evaluator schema changes precede reports that consume them.
6. Return one compact concern map for `review-changes` and `ship-changes`. Downstream workflows reuse it unless the diff materially changes.

Never include `results/`, prompts, patches, logs, repository paths, or local databases in a concern intended for GitHub.

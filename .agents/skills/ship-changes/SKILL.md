---
name: ship-changes
description: Ship approved Repo Automation Score changes through GitHub Issues, issue-numbered branches, isolated verification, commits, pull requests, required checks, and merges to main. Use only when the user explicitly asks to ship, commit and merge, split and ship, or finalize reviewed changes through the repository's GitHub workflow.
---

# Ship Changes

Ship reviewed concerns serially. Do not delegate operations that share Git or GitHub state. This workflow ends with a clean, synchronized `main`; it never authorizes deployment, package publishing, or uploading local run data.

Keep the shipping orchestrator on the strongest available tier. The only delegated prerequisite may be the complete read-only `split-changes` workflow under that skill’s single low-cost-worker policy. Never delegate mutable branch, stash, commit, push, pull-request, check-waiting, or merge operations.

## Audit

1. Confirm branch, upstream, complete tracked and untracked diff, stashes, existing issues, and open pull requests.
2. Reuse the latest `split-changes` concern map. Run that workflow first for a large or mixed diff without a current map.
3. Require high- and medium-severity review findings to be resolved. Explicitly accept or defer remaining low-severity findings.
4. Verify `results/`, logs, prompts, patches, local paths, credentials, and database files are ignored and absent from the diff and history.

## Ship one concern

1. Create or reuse a GitHub Issue with scope and acceptance criteria.
2. Synchronize `main`, then create `<issue-number>-<short-description>`.
3. Preserve unrelated work with a named safety stash when necessary and restore only the approved concern.
4. Run the concern's narrow checks. For application changes run `npm test`; for frontend changes also run `npm run test:web`, `npm run web:check`, and `npm run web:build`; validate changed skills; run `npm audit --audit-level=high` when dependencies change.
5. Run `git diff --check`, inspect the final diff and status, and commit with a concise issue reference.
6. Push and open a pull request containing `Closes #<number>`. Use a temporary body file for multiline Markdown.
7. Wait for expected required checks. Treat missing checks as pending, never success. Inspect stalled Actions and stop with a concrete blocker rather than bypassing protection.
8. Merge only after checks pass, delete the feature branch, return to `main`, fast-forward, and verify local `main` equals `origin/main` with a clean tree.

Only then start another concern. Report issues, branches, commits, pull requests, checks, merge state, leftovers, and recovery stashes.

---
name: develop-feature
description: Add, change, fix, or refactor Repo Automation Score product behavior across its browser UI, localhost API, repository discovery, agent-provider boundary, run lifecycle, artifacts, and reports. Use for user-facing features, API endpoints, provider integrations, persistence, accessibility, and runner orchestration; use maintain-evaluators instead when the primary change is scoring or scenario methodology.
---

# Develop Feature

1. Read the applicable contract under `docs/features/` and `docs/architecture.md` completely.
2. Read `docs/development/adding-a-feature.md`. For provider work, also read `docs/development/adding-a-provider.md`.
3. Write a compact acceptance ledger covering states, failures, permissions, artifacts, accessibility, and provider neutrality.
4. Inspect one matching implementation and its tests before editing.
5. Keep browser interaction separate from privileged local execution. Keep agent-specific behavior behind the provider boundary.
6. Add narrow tests for domain logic and boundary validation. Preserve auditable prompts and evidence.
7. Run `npm test`, applicable `node --check` commands from `AGENTS.md`, and `git diff --check`.
8. Verify the acceptance ledger and report checks actually run plus genuine limitations.

Do not make target repositories conform to this product's structure. Model repository capabilities and applicable templates explicitly.

# Providers and run execution

Repository discovery, prompt composition, run state, evidence, comparisons, and reports are provider-neutral. A provider adapter owns platform-specific authentication, models, options, command or API transport, event parsing, usage, cancellation, and failure classification.

Codex is the first provider. Sol, Luna, and Terra are models exposed by that provider; they are not product-level run types.

## Run lifecycle

```text
validate repository and guidance
  → record request and pinned revision
  → create temporary run directory and isolated worktree
  → invoke provider and normalize live activity
  → run repository checks and evaluator
  → commit normalized records to SQLite
  → remove temporary files and worktree
```

Retries are separate attempts. Review loops are ordered passes inside an attempt. Repetitions measure reliability across independent attempts; passes measure improvement from review within one attempt.

## Isolation and permissions

- Never mutate the attached repository working tree.
- Pin the base and guidance revisions used by the run.
- Give subprocesses explicit argument arrays, working directories, environment, timeouts, and cancellation behavior.
- Treat the provider as operating with the permissions of the local user who started the service.
- Do not store provider credentials or forward them to reports.
- Use an isolated Docker Compose project only when the selected target scenario requires it.

## Event normalization

The UI may receive bounded agent updates, command start/completion, file changes, checks, errors, retries, and completion. Raw provider diagnostics stay temporary. Explicit agent messages can be summarized, but hidden reasoning must not be requested, presented, or persisted.

Adding a provider follows [`../development/providers/adding-a-provider.md`](../development/providers/adding-a-provider.md).

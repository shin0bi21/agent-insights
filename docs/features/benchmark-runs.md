# Benchmark runs

A run combines a repository revision, frontend/backend/full-stack feature scope, prompt, provider and model configuration, isolation policy, evaluator version, and optional template or reference implementation. The user selects scope; `AGENTS.md` owns workflow and skill routing inside the target repository.

Runs execute in disposable isolated worktrees and never in the user's working tree. The system records configuration, prepared prompt, normalized events, timing, usage, final response, patch, changed files, check output, and report data. Run states are queued, preparing, running, evaluating, completed, failed, cancelled, or timed out.

Run evidence is local-private by default. It is stored only under the ignored `results/` directory, is not written to an application database, and is never sent to GitHub. A future remote runner, synchronization feature, or hosted database must require explicit opt-in, disclose the exact data transferred, and define retention and deletion behavior before implementation.

Retries create distinct attempts. Cancellation must stop the process group and clean target-owned resources when safe while preserving diagnostic artifacts.

The Home view owns run configuration and displays exactly one run: the newest attempt, regardless of status. Starting another run moves the previous card into History. The History view owns every earlier attempt, including interrupted or still-running attempts, so stale process state can never produce multiple Current run cards.

During a run, the API converts the provider's structured event stream into a bounded live activity tree. The primary UI may show explicit agent messages, commands, file changes, completion state, and failures; it must not present private chain-of-thought as progress. Raw provider diagnostics remain available in a secondary disclosure for troubleshooting and run artifacts remain local and ignored by Git.
The activity tree has a fixed bounded height and scrolls internally so long runs do not continuously expand the Current run card. Its scroll region remains keyboard focusable.
On desktop, the Current run panel is bounded by the measured setup-panel height and scrolls internally; stacked mobile layouts use their natural document height.

Run cards keep completed results compact. Repository paths and provider settings belong in a job-configuration view. Scores and implementation evidence belong in a report view whose headline metrics are score, elapsed time, and consumed tokens, followed by structural-contract results and expandable agent-versus-reference evidence.

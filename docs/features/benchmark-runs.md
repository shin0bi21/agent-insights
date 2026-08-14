# Benchmark runs

A run combines a repository revision, frontend/backend/full-stack feature scope, prompt, provider and model configuration, isolation policy, evaluator version, and optional template or reference implementation. The user selects scope; `AGENTS.md` owns workflow and skill routing inside the target repository.

Runs execute in disposable isolated worktrees and never in the user's working tree. The system records configuration, prepared prompt, normalized events, timing, usage, final response, patch, changed files, check output, and report data. Run states are queued, preparing, running, evaluating, completed, failed, cancelled, or timed out.

Run evidence is local-private by default. It is stored only under the ignored `results/` directory, is not written to an application database, and is never sent to GitHub. A future remote runner, synchronization feature, or hosted database must require explicit opt-in, disclose the exact data transferred, and define retention and deletion behavior before implementation.

Retries create distinct attempts. Cancellation must stop the process group and clean target-owned resources when safe while preserving diagnostic artifacts.

The Home view owns run configuration and displays active runs so progress remains visible while starting work. The History view owns completed, failed, cancelled, and timed-out runs; active runs do not appear in that archive until they reach a terminal state.

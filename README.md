# Repo Automation Score

Repo Automation Score is a local-first application that measures how reliably AI agents can understand, change, and verify a repository. It combines repository-readiness signals with isolated agent runs, deterministic evaluation, and actionable reports. It does not modify or become part of the target repository.

The first scenario asks agents to build the Staff Tasks feature from the commit immediately before Tasks existed. Its manifest overlays a pinned snapshot of current repository guidance onto that historical application revision, then creates a disposable synthetic baseline commit so guidance is visible but excluded from the candidate diff and score. Scenario manifests are versioned; do not combine results from different prompt or guidance versions in one model comparison. Preview the matrix:

```bash
node backend/src/run-agent-benchmark.mjs \
  --repo /Users/bilalkhan/Desktop/my-webapp \
  --scenario tasks-page \
  --dry-run
```

Run a single-model pilot before spending time on a full matrix:

```bash
node backend/src/run-agent-benchmark.mjs \
  --repo /Users/bilalkhan/Desktop/my-webapp \
  --scenario tasks-page \
  --models gpt-5.6-luna \
  --reasoning-efforts low \
  --repetitions 1
```

The runner uses the locally authenticated Codex CLI, executes models serially in detached disposable worktrees, and stores live events/progress, token usage, timing, patches, final responses, changed files, and grades under `results/`. Each candidate receives an isolated Docker Compose project without host ports. Successful worktrees are removed; failed or timed-out worktrees are retained for diagnosis.

The default matrix compares Luna, Terra, and Sol at low, medium, and high reasoning. Validate one model across the three levels before launching all nine cells. Use at least three repetitions per cell before drawing final quality conclusions, and keep the scenario baseline, prompt version, timeout, and evaluator identical. Reports include score range and standard deviation, all-gates pass rate, and recurring missed contracts; a single high score is capability evidence, not reliability evidence.

## Local web interface

Start the local-first browser interface:

```bash
npm run web
```

Then open `http://127.0.0.1:4173`. `npm run web` builds the React/TypeScript frontend and serves it through the local backend. For development with Vite reloads, use `npm run web:dev` and open `http://127.0.0.1:5173`. Connect a local Git repository, choose a discovered `.agents/skills` or `.codex/skills` workflow, select an agent platform, model, and reasoning effort, and enter a feature description. Web-launched artifacts are stored under `results/web-runs/`.

The product model is agent-platform-neutral: the UI and run records use a provider catalog, with Codex as the first adapter and Luna/Terra as its initial models. Other coding-agent platforms can be added behind the same provider boundary. The current executable benchmark remains the versioned `tasks-page` scenario, whose pinned revisions and evaluator target `my-webapp`; generic scenario/reference construction is the next required capability before arbitrary repositories can complete runs.

The service binds only to localhost. It executes Codex, Git, dependency setup, Docker, and evaluator commands with the permissions of the terminal that launched it. The browser/server boundary is intentionally narrow so this UI can later be wrapped with Tauri for desktop distribution.

See [Architecture](docs/architecture.md) for the provider boundary and planned reference-comparison pipeline.

# Local setup

## Requirements

- Node.js 22 or newer
- Git
- an authenticated CLI or API configuration for the selected agent provider
- tools required by the attached target repository
- Docker Desktop, or Docker Engine with Compose, when using the optional container runtime or a target-owned Docker scenario

## Prepare the application

```bash
npm install
npm run db:migrate
npm run db:status
```

The SQLite database is created under ignored `data/` storage by default. Do not commit database, WAL, run, log, or provider credential files.

Validate the checkout before a real run:

```bash
npm run validate:skills
npm run validate:docs
npm run backend:check
npm test
npm run web:check
npm run test:web
```

Use a dry run to validate a scenario and matrix without spending provider tokens. A real run uses the permissions and provider authentication of the terminal user.

## Docker setup

Docker is an alternative to installing Node.js dependencies on the host. Copy the non-secret template and replace both placeholder paths with absolute host paths:

```bash
cp .env.example .env
mkdir -p /absolute/path/to/repo-automation-score-runtime
docker compose config
docker compose build
```

`RAS_REPOSITORY_PATH` identifies the one attached Git repository. `RAS_RUNTIME_PATH` is a dedicated disposable worktree directory. Both are mounted at the same absolute paths inside the container; do not point either value at a home directory or broad source root.

Authenticate the currently installed Codex provider into its dedicated named volume:

```bash
docker compose run --rm app codex
```

Complete sign-in, then exit the interactive CLI. Start the default application stack without host Docker access:

```bash
docker compose up -d
docker compose ps
```

Open `http://127.0.0.1:4173`. The container is Linux, so the macOS folder picker is unavailable; enter the exact `RAS_REPOSITORY_PATH` value and select **Connect**.

If the selected target repository or scenario launches Docker, use the explicit runner override instead:

```bash
docker compose -f docker-compose.yml -f docker-compose.runner.yml up -d
```

The override mounts the host Docker socket and therefore grants the application host-level container control. Use it only with repositories and prompts you trust. Docker Desktop or the host daemon must be allowed to share both configured paths.

The image includes Node.js, npm, Git, SSH, Codex, and Docker CLI. A target repository that requires another language or operating-system package needs a deliberate Dockerfile extension; use the native startup path until that toolchain is supported.

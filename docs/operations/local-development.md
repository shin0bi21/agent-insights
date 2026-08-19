# Local development

Use [Setup](setup.md) for first-time requirements and installation.

## Start and restart

Production-style local build:

```bash
npm run web
```

Open `http://127.0.0.1:4173`.

Development watchers:

```bash
npm run web:dev
```

Open the Vite URL printed by the process, normally `http://127.0.0.1:5173`. Backend TypeScript changes restart the loopback API; frontend changes use Vite hot reload. When a stale process owns a port, identify that exact listener before stopping it and restart both boundaries together.

## Database commands

```bash
npm run db:migrate
npm run db:status
npm run db:import-results
```

SQLite is the only durable run store. `db:import-results` remains a one-time upgrade path for installations with unimported `results/web-runs`; verify the normalized data before removing the ignored source directory. New installations default to `data/agent-automation-score.sqlite`; a renamed installation reuses the previous database when present. Override it with `AGENT_AUTOMATION_SCORE_DB_PATH` for tests or packaging. Web-managed runner output is removed after successful normalization. Standalone CLI diagnostics remain at the printed path until explicitly removed.

## Run execution

The service runs with the terminal user's permissions and must remain on loopback. Active files live in the operating system's temporary directory and are deleted after successful normalization. A normalization failure retains the temporary directory and prints its path.

Preview scenario and matrix configuration with `--dry-run` before a real run. Docker is used only when the target scenario requires it. Do not call a run successful until the exact provider, evaluator, and report path has completed.

## Docker lifecycle

After completing [Docker setup](setup.md), use one consistent Compose file set for a session:

```bash
docker compose up -d
docker compose ps
docker compose logs --follow --tail=100 app
docker compose down
```

Rebuild after changing the Dockerfile, lockfile, compiled application code, or the pinned provider version:

```bash
docker compose up -d --build
```

Run database operations and inspect installed tools inside the container:

```bash
docker compose exec app node backend/dist/db/status-cli.js
docker compose exec app codex --version
docker compose exec app docker compose version
```

`app_data` retains SQLite and `codex_state` retains provider authentication across ordinary restarts and `docker compose down`. Their default engine-level names remain `repo-automation-score_app_data` and `repo-automation-score_codex_state` so renamed installations keep existing state. Set `AAS_APP_DATA_VOLUME` or `AAS_CODEX_STATE_VOLUME` only when intentionally selecting different volumes. Deleting volumes erases that local state and is not a routine restart operation.

For a trusted target-owned Docker scenario, set `AAS_DOCKER_SOCKET_PATH=/var/run/docker.sock` in `.env` and recreate the service. Leave it as `/dev/null` otherwise. The host and container runtime paths must remain identical; changing `.env` requires recreating the service. Existing `RAS_*` variables remain deprecated compatibility aliases.

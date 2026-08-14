# Docker development

Docker is an optional packaging boundary for the existing application, not a second architecture. The image builds the Vite client and TypeScript backend, then runs the compiled Express service with SQLite, Git, Docker CLI tooling, and the currently pinned Codex CLI.

## File ownership

| Path | Owns |
|---|---|
| `Dockerfile` | Multi-stage dependencies, application builds, runtime tools, health check, and process command |
| `.dockerignore` | Build-context privacy and size boundary |
| `docker-compose.yml` | Loopback port, persistent application/provider volumes, and explicit repository/runtime mounts |
| `docker-compose.runner.yml` | Privileged host Docker socket opt-in for target-owned Compose |
| `.env.example` | Non-secret local path and version template |

## Required invariants

- Keep host exposure on `127.0.0.1`; `0.0.0.0` is only the container-internal bind address.
- Mount exactly the selected repository rather than a home directory or broad source root.
- Mount the runtime directory at the same absolute path on host and container. Nested Docker receives host-resolvable worktree paths from that directory.
- Keep SQLite and provider state in separate named volumes. Never bake either into an image or commit them.
- Keep the Docker socket out of the default stack. The runner override is privileged and only applies to scenarios or repositories that launch Docker.
- Pin provider tooling through a build argument and document upgrades. Provider installation belongs in a replaceable image layer; application code remains provider-neutral.
- Run compiled backend code in production mode. Native development continues to use `tsx` and Vite watchers.
- Treat target-repository toolchains as an explicit compatibility boundary. The base image supplies Node.js, npm, Git, SSH, Codex, and Docker CLI; repositories that require other languages or system packages need a deliberate image extension or the native runtime.

## Changing the setup

Validate environment interpolation with `docker compose config`, then build the image, start it, wait for a healthy service, inspect `/api/health`, verify the provider CLI version, and check database migration status inside the container. Test the runner override separately because image success does not prove host Docker socket access or symmetric-path behavior.

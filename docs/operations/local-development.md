# Local development

Requirements are Node.js 22 or newer, Git, an authenticated agent provider CLI, and any tools required by the target repository. Docker is required only when the selected target scenario uses it.

Run tests with `npm test`. Start the service with `npm run web` or use `npm run web:dev` for server reloads, then open `http://127.0.0.1:4173`.

The service runs with the terminal user's permissions. Do not expose it beyond loopback. Generated artifacts live under `results/` and are intentionally ignored by Git. Preview matrices with `--dry-run` before real execution. If a run fails, inspect its runner log, setup output, events, result, and evaluator evidence before retrying.

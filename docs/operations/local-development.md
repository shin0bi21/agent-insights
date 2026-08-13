# Local development

Requirements are Node.js 22 or newer, Git, an authenticated agent provider CLI, and any tools required by the target repository. Docker is required only when the selected target scenario uses it.

Install pinned dependencies with `npm install`. Run backend tests with `npm test`, frontend tests with `npm run test:web`, and TypeScript checks with `npm run web:check`.

Start the production-style local app with `npm run web`, then open `http://127.0.0.1:4173`. Use `npm run web:dev` for the backend watcher and Vite development server, then open `http://127.0.0.1:5173`.

The service runs with the terminal user's permissions. Do not expose it beyond loopback. Generated artifacts live under `results/`, are intentionally ignored by Git, and are not persisted to a database or remote service. Preview matrices with `--dry-run` before real execution. If a run fails, inspect its runner log, setup output, events, result, and evaluator evidence before retrying.

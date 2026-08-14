# Testing

Use the narrowest authoritative test while developing and the complete affected boundary before handoff.

| Concern | Command |
|---|---|
| Backend behavior, persistence, evaluator, and API | `npm test` |
| Backend TypeScript | `npm run backend:check` |
| Backend production build | `npm run backend:build` |
| Frontend components and workflows | `npm run test:web` |
| Frontend TypeScript | `npm run web:check` |
| Frontend production build | `npm run web:build` |
| Repository skills | `npm run validate:skills` |
| Local documentation links | `npm run validate:docs` |
| Migration state | `npm run db:status` |
| Whitespace and patch integrity | `git diff --check` |

Backend tests use Node's test runner across `backend/test/*.test.ts`. Frontend tests use Vitest and jsdom. Use a real browser smoke check when behavior depends on geometry, scroll placement, focus containment, pointer input, or responsive layout.

A dry run verifies scenario configuration without provider cost. A real agent run is not part of ordinary local verification; run it only when provider execution itself changed or the user explicitly wants an empirical benchmark.

Report exactly which commands ran. Do not call a typecheck, focused file, dry run, or injected-provider test a real end-to-end agent run.

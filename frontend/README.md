# Repo Automation Score frontend

React + TypeScript + Vite browser interface for repository setup, run progress, history, settings, and reports.

## Documentation

| Area | Canonical document |
|---|---|
| Frontend architecture | [`../docs/architecture/frontend.md`](../docs/architecture/frontend.md) |
| Product features | [`../docs/features/README.md`](../docs/features/README.md) |
| Development handbook | [`../docs/development/README.md`](../docs/development/README.md) |
| Application workflows | [`../docs/development/frontend/application-workflows.md`](../docs/development/frontend/application-workflows.md) |
| Interactions and overlays | [`../docs/development/frontend/interactions.md`](../docs/development/frontend/interactions.md) |
| Local development | [`../docs/operations/local-development.md`](../docs/operations/local-development.md) |
| Testing | [`../docs/operations/testing.md`](../docs/operations/testing.md) |

## Stack

| Concern | Technology |
|---|---|
| UI | React 19 |
| Language | TypeScript 5.9 |
| Build and development | Vite 7 |
| Tests | Vitest, Testing Library, jsdom |

## Ownership

```text
App workflow → typed API adapter → localhost API
      │
      └── common interaction and report components
```

- `src/App.tsx` owns top-level Home, History, and Settings composition.
- `src/api.ts` owns every localhost HTTP request.
- `src/types.ts` owns normalized browser-facing contracts.
- `src/common/components/` owns reusable menus, selectors, activity, and report presentation.
- `src/styles.css` currently owns application-wide layout and theme styles.

The browser never accesses repositories, credentials, Git, subprocesses, or SQLite directly. It polls normalized run state from the API and keeps only transient interaction state locally.

Run `npm run test:web`, `npm run web:check`, and `npm run web:build` after frontend changes.

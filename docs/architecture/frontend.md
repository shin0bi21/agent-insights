# Frontend architecture

The frontend is a React and TypeScript application built with Vite. It presents repository connection, run setup, live activity, history, settings, and reports while treating the localhost API as its only privileged boundary.

Unless stated otherwise, paths are relative to `frontend/`.

```text
React view → typed API adapter → localhost Express API
     │
     └── common components and presentation helpers
```

## Ownership map

| Path | Owns |
|---|---|
| `src/main.tsx` | React root and application bootstrap |
| `src/App.tsx` | Route-like view selection, repository setup, run lifecycle presentation, and top-level state |
| `src/api.ts` | Typed HTTP requests to the localhost API |
| `src/types.ts` | Browser-facing provider, repository, run, activity, and report contracts |
| `src/common/components/` | Reusable interaction and report units |
| `src/styles.css` | Current application-wide design tokens and layout |

The current application is intentionally small. Split `App.tsx` into pages, feature hooks, or route infrastructure when an extracted owner has a coherent contract and tests; do not create directories only to imitate a larger application.

## Boundary rules

- All HTTP requests go through `src/api.ts`; components do not construct service URLs ad hoc.
- Browser types use normalized provider-neutral objects, never raw Codex event shapes.
- Repository paths are transient connection input. Active job inspection may show runtime-only repository and worktree paths from the loopback service; completed records expose the durable repository name, not a stored absolute path.
- Remote run state comes from the API. Local React state owns view selection, form input, open overlays, and appearance preferences.
- Reusable interaction primitives belong under `common/components`; run-specific report content may compose them without moving privileged logic into the browser.
- Components must not reveal private chain-of-thought. Live activity is limited to explicit messages, commands, file changes, checks, and outcomes.

## Interaction and accessibility

Floating menus calculate upward or downward placement from available viewport space, close when their scroll context moves, and keep overflow inside a bounded panel. Dialog-style reports lock background scrolling and remain keyboard dismissible. Live activity is a named, keyboard-focusable scroll region with a bounded height.

Use semantic buttons, labels, fieldsets, status regions, dialogs, and visible focus states. Put browser geometry, focus, scrolling, and pointer behavior behind focused tests when jsdom cannot establish the behavior reliably.

## Verification

Run `npm run test:web`, `npm run web:check`, and `npm run web:build`. Add focused component tests beside reusable components and keep application tests for workflow composition.

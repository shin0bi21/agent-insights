# Frontend

The frontend is a React and TypeScript application built with Vite. It owns accessible user interaction and presentation for repository connection, provider configuration, run progress, and score reports. It communicates only through typed localhost API functions in `src/api.ts` and must not access repositories, credentials, or subprocesses directly.

Run `npm run test:web`, `npm run web:check`, and `npm run web:build` after frontend changes.

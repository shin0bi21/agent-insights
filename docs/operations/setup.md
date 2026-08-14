# Local setup

## Requirements

- Node.js 22 or newer
- Git
- an authenticated CLI or API configuration for the selected agent provider
- tools required by the attached target repository
- Docker only when the selected scenario or target repository requires it

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

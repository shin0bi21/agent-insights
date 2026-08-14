# Continuous integration

The supported branch flow is:

```text
feature branch -> pull request -> develop -> release pull request -> main
```

Feature work targets `develop`. Pull requests targeting `main` are accepted only from `develop`; the CI merge-path job rejects every other source branch. Merging to either branch does not deploy or publish the package.

CI runs the backend and frontend TypeScript checks, backend and frontend tests, and both production builds. Configure both jobs in `.github/workflows/ci.yml` as required checks in the GitHub branch rulesets for `develop` and `main`; workflow YAML cannot enable repository rulesets by itself.

Repository skill validation is part of the same required verification job. The validator is implemented in TypeScript and has no Python or PyYAML dependency.

Local verification uses the same commands:

```bash
npm run validate:skills
npm run backend:check
npm test
npm run web:check
npm run test:web
npm run backend:build
npm run web:build
```

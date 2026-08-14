# Continuous integration architecture

CI is the merge gate for pull requests into `develop` and release pull requests into `main`. Repository package scripts provide the reproducible local interface; `.github/workflows/ci.yml` orchestrates those commands remotely.

```text
feature branch → pull request → develop → release pull request → main
```

The workflow rejects feature pull requests that target `main`. Shipping to `develop`, releasing to `main`, deployment, and package publication are separate authorization boundaries.

The required verification surface is skill and documentation-link validation, backend typecheck/tests/build, and frontend typecheck/tests/build. Exact commands and operator procedures live in [`../operations/ci.md`](../operations/ci.md).

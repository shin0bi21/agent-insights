# Development

Work from contracts outward:

1. Read the applicable feature contract under `docs/features/`.
2. Read `docs/architecture.md` for the boundary being changed.
3. Preserve provider-neutral domain objects and structured evidence.
4. Add the narrowest authoritative tests with the change.
5. Run `npm test` and applicable syntax or smoke checks.

Use [Adding a feature](adding-a-feature.md) for new product behavior, [Adding an agent provider](adding-a-provider.md) for another agentic platform, and [Adding an evaluator](adding-an-evaluator.md) for scoring changes.

Before shipping, follow [Review and shipping](review-and-shipping.md): make the top-level split decision, review each concern with current verification evidence, and ship approved concerns serially through an issue-numbered branch and pull request into `develop`. Returning to clean synchronized `develop` completes feature shipping. A release pull request to `main`, deployment, and package publication each require separate authorization.

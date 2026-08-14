# Scenarios

Scenarios are versioned executable experiments, not product documentation. Each scenario owns its prompt, pinned target and guidance revisions, model matrix defaults, evaluator checks, structural requirements, and timeouts.

`tasks-page/` is currently the only scenario. Its manifest declares the target repository's Docker Compose service names. The runner uses that declaration to generate a temporary isolation override that removes host ports and assigns per-run container names so benchmark environments do not collide. Service assumptions are scenario-specific and must not become universal evaluator requirements.

Product and contributor guidance belongs under `docs/`; reusable cross-scenario code belongs under `backend/src/`.

Do not compare results from different scenario versions as one experiment.

# Scenarios

Scenarios are versioned executable experiments, not product documentation. Each scenario owns its prompt, pinned target and guidance revisions, model matrix defaults, evaluator checks, structural requirements, and timeouts.

`tasks-page/` is currently the only scenario. The root `docker-compose.benchmark.yml` is shared execution infrastructure: it overlays the target repository's Compose configuration, removes host ports, and assigns per-run container names so benchmark environments do not collide. It currently assumes the `my-webapp` service names and must become a selectable isolation adapter before arbitrary repository templates can use it.

Product and contributor guidance belongs under `docs/`; reusable cross-scenario code belongs under `backend/src/`.

Do not compare results from different scenario versions as one experiment.

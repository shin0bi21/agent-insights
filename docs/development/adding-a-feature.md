# Adding a feature

Define the user workflow, state transitions, failure behavior, persisted artifacts, and accessibility behavior before implementation. Update or add the narrowest contract under `docs/features/`.

Keep browser code responsible for interaction and presentation. Keep repository access, subprocesses, secrets, path validation, and artifact writes in the localhost service. Do not expose platform-specific event shapes to the UI; normalize them at the provider boundary.

Add unit tests for domain and parsing logic. Add API tests when request validation or lifecycle changes. Smoke-test the actual browser/service boundary without launching a paid agent run unless execution is the behavior under test.

# Adding an agent provider

A provider adapter must expose identity, available models and options, availability diagnostics, command or API execution, normalized progress events, usage, final output, cancellation, and failure classification.

Provider credentials remain local and must not enter run artifacts. Repository discovery, skill selection, isolation, evaluation, comparison, and reports must not branch on provider-specific concepts.

Add contract tests using a fake process or transport. Exercise one real opt-in smoke run before declaring the adapter operational, and report its exact authentication and permission requirements.

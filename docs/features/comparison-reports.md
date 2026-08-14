# Comparison reports

Reports are generated from structured run and evaluation data. They summarize outcome, reliability, duration, usage, failed checks, missed contracts, meaningful reference differences, and limitations.

Scenario reports include an implementation review grouped by applicable backend and frontend subsections. Each subsection shows matching candidate files beside files from the pinned reference revision, including migrations, routes, controllers, services, policies, focused tests, pages, components, component tests, and hooks. Reference evidence provides context and does not require byte-identical directory parity. Frontend-only and backend-only runs omit inapplicable sections and points.

Recommendations identify where repository instructions, feature contracts, examples, tests, evaluators, skills, or delegated work could improve future automation. Each recommendation cites evidence and confidence. Reports must separate repository-readiness gaps, agent implementation failures, evaluator limitations, and external environment failures.

HTML is the primary interactive view. PDF export presents the same normalized report and does not introduce conclusions absent from the source data.

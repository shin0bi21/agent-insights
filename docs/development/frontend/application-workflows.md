# Frontend application workflows

`frontend/src/App.tsx` currently owns the Home, History, and Settings views plus repository setup and current-run orchestration. Keep it readable as composition; extract a page, hook, or feature only when that unit has a coherent state or interaction contract.

## State ownership

- API run records are the authoritative remote state.
- The newest run appears on Home; every earlier run appears in History.
- Form input, selected view, theme, and open overlays are local UI state.
- Starting or retrying is disabled while a run is active.
- Historical retries require a newly connected repository when no transient path exists.

Use `src/api.ts` for every request and `src/types.ts` for normalized API contracts. Keep raw provider fields out of components.

## Run presentation

Active runs may show bounded live activity and a troubleshooting disclosure. Completed runs expose their report and avoid duplicate job configuration. Failed, timed-out, interrupted, or cancelled runs expose Retry Run. Status is conveyed with text as well as color.

Keep report summary, agent overview, token summary, findings, and implementation detail derived from the same run projection.

# Common components

This directory owns reusable browser interaction and report-presentation units. Components here consume normalized frontend contracts and never access repositories, providers, subprocesses, or SQLite directly.

| Component | Responsibility | Local contract |
|---|---|---|
| `FloatingMenu` | Shared anchored or centered overlay behavior | [FloatingMenu/README.md](FloatingMenu/README.md) |
| `FloatingSelect` | Custom accessible selection with shared overlay behavior | [FloatingSelect/README.md](FloatingSelect/README.md) |
| `RunActivityTree` | Bounded structured live progress | [RunActivityTree/README.md](RunActivityTree/README.md) |
| `RunReportMenu` | Centered report presentation | [RunReportMenu/README.md](RunReportMenu/README.md) |
| `ImplementationReview` | Grouped backend/frontend evidence rendering | Feature-owned presentation contract |
| `RunJobMenu`, `RunRequestMenu` | Small run disclosures composed with the shared overlay | Follow `FloatingMenu` behavior |

Keep components domain-agnostic when practical, but do not hide run terminology behind generic abstractions when the component only serves run reports. Colocate focused behavior tests with the component.

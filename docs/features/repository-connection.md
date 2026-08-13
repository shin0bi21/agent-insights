# Repository connection

Users connect a local Git repository by path or a native folder picker. The localhost service owns native selection because browser upload APIs do not provide a usable absolute repository path. The service validates the repository boundary and discovers agent entry points and skills without assuming a framework or documentation layout. Current explicit skill roots are `.agents/skills` and `.codex/skills`; discovery should grow through adapters rather than unbounded filesystem scanning.

Connection reports discovered guidance, skills, Git state, and compatible scenario or template capabilities. Connecting does not authorize mutation or execution. Invalid and unsupported repositories return actionable errors without leaking unrelated filesystem information.

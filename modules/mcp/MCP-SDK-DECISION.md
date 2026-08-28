# MCP SDK decision

Decision: retain the local JSON-RPC transport for Phase 2.

`@modelcontextprotocol/sdk` is not present in `package.json` or the installed dependency set. Adding it would expand dependency and lockfile scope beyond the Viking Phase 2 handoff. The server therefore keeps its explicit MCP-compatible `initialize`, `resources/list`, and `resources/read` handlers, plus the existing `viking/*` compatibility methods. Contract tests remain the conformance evidence.

Revisit adoption when dependency installation and lockfile changes are explicitly approved. The resolver remains transport-independent, so SDK registration can replace only `viking-vfs-server.mjs`.
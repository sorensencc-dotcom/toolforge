# Toolforge Governance

This document defines naming conventions, versioning rules, and lifecycle expectations for all tools generated inside Toolforge.

---

## Naming Conventions

### Tool Names
- Use **kebab-case** for directories:  
  `multi-repo-sync`, `cic-drift-detector`, `maal-router-check`
- Use **PascalCase** for TypeScript classes.
- Prefix MCP servers with `mcp-`:  
  `mcp-ingestion-server`, `mcp-redesign-server`

### Directory Placement
- Long-running processes → `daemons/`
- MCP servers → `mcp-servers/`
- Protocol bridges → `adapters/`
- Multi-repo orchestration → `sync-tools/`
- Templates → `scaffolds/`
- Experiments → `prototypes/`
- Small helpers → `utilities/`

---

## Versioning

### Semantic Versioning (SemVer)
All tools follow:

MAJOR.MINOR.PATCH

- **PATCH** — small fixes, log improvements, minor behavior changes  
- **MINOR** — new features, new modules, new repo integrations  
- **MAJOR** — architectural changes, breaking changes, new pipelines

### Version Storage
Each tool must include:

VERSION.md

containing:

version: x.y.z
date: YYYY-MM-DD
notes:

change 1

change 2


---

## Lifecycle

### Stages
1. **Prototype** → early experiments  
2. **Scaffold** → structured template  
3. **Tool** → stable, documented  
4. **Daemon** → scheduled, long-running  
5. **Retired** → archived, no longer used

### Promotion Rules
- Prototype → Scaffold: when structure stabilizes  
- Scaffold → Tool: when integrated with at least one repo  
- Tool → Daemon: when scheduled or automated  
- Tool/Daemon → Retired: when replaced or deprecated

---

## Logging Requirements

All tools must:
- Emit structured JSON logs  
- Use deterministic error codes  
- Avoid side effects outside their directory  
- Never write into production repos directly  

---

## Security

- No secrets committed  
- `.env` files ignored  
- Webhooks stored in environment variables  


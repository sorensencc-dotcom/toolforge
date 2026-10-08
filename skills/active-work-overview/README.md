# Active Work Overview

Aggregates active pull requests, recent code landings, engineering git worktrees, open backlog items from `TODOS.md`, mobile action receipts, and daemon telemetry into a single structured report.

## Quick Start

```bash
# Print formatted Markdown overview
node C:\dev\skills\active-work-overview\src\overview.mjs

# Emit raw JSON payload
node C:\dev\skills\active-work-overview\src\overview.mjs --json
```

## What It Collects

- **GitHub PRs & Landings**: Active open pull requests and recently merged landings across ecosystem repositories.
- **Git Worktrees**: Active development worktrees and feature branches across `C:\dev` and `C:\dev\sigil-repo`.
- **Backlog Items**: Prioritized items (`P0`, `P1`, `P2`) parsed from `C:\dev\TODOS.md`.
- **Mobile Ingress & Outbox**: Pending or staged action receipts from `trm-drive/inbox/outbox` and `.trm/inbox/outbox`.
- **System Telemetry**: Real-time status from IronLedger, KB-Sync, CI alerts, and the port 8080 daemon.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

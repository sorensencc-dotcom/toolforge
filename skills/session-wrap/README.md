# session-wrap

Atomic session wrap-up: doc updates → scoped git stage → prefixed commit → report.

## Quick Start

```bash
npm run wrap -- --commitMessage "[claude] Session wrap" --summary "Work complete"
```

## What it does

- Writes documentation updates to specified paths (parent dirs auto-created)
- Stages only changed files + explicit paths (not `git add -A` by default)
- Creates prefixed atomic commit with required prefix (`[claude]`, `[copilot]`, etc.)
- Generates session summary report
- Supports dry-run preview without modifying git

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For v1.1.0 changes, worked examples:** See [docs/USAGE.md](docs/USAGE.md).

# Tool Lifecycle Manager

Enforce Toolforge governance rules for tool classification, versioning, status transitions, and deployment readiness.

## Quick Start

```bash
npx toolforge-validate-tool -Name myTool -Action readiness-check
npx toolforge-validate-registry -Action full-audit
```

## What it does

- Validates tool classification (sync-tools, daemons, adapters, etc.)
- Enforces semantic versioning and status progression
- Checks manifest registration and quality gates
- Reports production readiness or blockers
- Audits entire registry for drift and misclassification

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For governance rules, quality gates, output examples:** See [docs/USAGE.md](docs/USAGE.md).

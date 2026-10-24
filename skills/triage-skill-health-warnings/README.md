# Triage skill health warnings

Turn a noisy health report into per-group fixes and closed todo rows.

## Quick start

Say "skill health warnings". Claude groups the report, fixes each group in the affected skills only, and flips the matching AGENTS.md rows to done.

## What it does

- Groups warnings by check: AuditLog, Manifest, Runtime, DryRun.
- Regenerates the report to a scratch path and never commits report-only churn.
- Closes a todo row only after the fresh report no longer lists its group.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

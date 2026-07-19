# rollback-phase

Revert CIC pipeline execution to a prior phase checkpoint.

---

## Quick Start

```bash
rollback-phase 18
```

---

## What it does

- Verifies checkpoint exists and restores PostgreSQL state from snapshot
- Clears partial vectors from Qdrant to ensure clean resume
- Returns ready status with checkpoint details and next action

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

For detailed workflow and examples: See [SKILL.md](./SKILL.md).

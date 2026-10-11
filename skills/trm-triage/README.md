# TRM Triage

Autonomous task card triage engine applying YAGNI evaluation, reversibility classification, and GitHub Issue promotion payloads.

## Quick Start

```bash
node skills/trm-triage/src/index.mjs
```

## What it does

- Scans staged action cards across `.harness/tasks/pending` and `.harness/tasks/archive`.
- Evaluates YAGNI, reversibility risk (one-way vs two-way doors), and completion status.
- Generates pre-filled GitHub Issue payloads for 1-click promotion in the ICF dashboard.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

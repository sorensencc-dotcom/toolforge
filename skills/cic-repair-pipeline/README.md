# cic-repair-pipeline

Detect and repair broken CIC pipeline stages.

---

## Quick Start

```bash
cic repair-pipeline --stage=INGEST --mode=auto
```

---

## What it does

- Scans pipeline stage and diagnoses failures
- Applies automatic repairs or generates diagnostic report
- Restores stage manifest and validates readiness

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

For detailed workflow and examples: See [SKILL.md](./SKILL.md).

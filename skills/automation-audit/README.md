# Automation Audit

Read-only repo scan for automation opportunities: oversized logs, backup dirs needing retention policy, manual-step markers.

## Quick Start

```bash
npm test
```

## What it does

- Scans for log files exceeding size threshold
- Identifies backup/archive folders needing retention policy
- Finds scripts with manual-step markers (TODO, manual) that should be scheduled

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For detailed workflow:** See [docs/USAGE.md](docs/USAGE.md).

# CIC Consolidate Artifacts

**CIC artifact consolidation and verification tool.**

## Quick Start

```bash
cic consolidate-artifacts --mode=strict
```

## What It Does

Consolidates artifacts from multiple sources and verifies integrity.

## Verification Modes

| Mode | Behavior |
|------|----------|
| strict | Fail on any validation error |
| lenient | Warn on errors, continue |

---

See [INTEGRATION_DIAGRAM.md](INTEGRATION_DIAGRAM.md) for architecture.

# CIC Run Gate

**Execute CIC validation gates and produce conformance reports.**

## Quick Start

```bash
cic run-gate --scope=full --format=verbose
```

## What It Does

Runs the comprehensive CIC validation gate across all pipeline stages.

## Scope Options

| Scope | Target |
|-------|--------|
| full | All stages and cross-dependencies |
| partial | Selected stage group |
| single-stage | Individual stage only |

## Output

- gate validation report
- pass/warn/fail verdict
- remediation suggestions

---

See [INTEGRATION_DIAGRAM.md](INTEGRATION_DIAGRAM.md) for gate architecture.

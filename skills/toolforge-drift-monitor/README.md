# Toolforge Drift Monitor

Detects synchronization drift between canonical and distributed Toolforge instances.

**Status**: Operational  
**Version**: 0.1.0  
**Runtime**: Node.js 20+

---

## What it does

- Compares canonical vs distributed Toolforge instances for file parity
- Detects version misalignment and tool implementation gaps
- Generates drift reports with OK/WARNING/CRITICAL status
- Runs daily via Task Scheduler at 09:00 UTC

---

## Quick Start

```bash
# Manual scan
cd C:\dev\toolforge
node sync-tools/multiRepoRoadmapSync/multiRepoRoadmapSync.cjs

# Or via CLI
npx toolforge drift-monitor --check all
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation).

This skill requires:

- Node.js 20+
- Canonical Toolforge instance at C:\dev\toolforge\
- Write access to C:\dev\toolforge\drift\

---

## Integration

See [SKILL.md](./SKILL.md) for execution metadata.

For when to use, manual invocation options, output formats, and troubleshooting:

**→ See [docs/USAGE.md](./docs/USAGE.md)**

---

## Reference

→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Setup, Requirements, Error Handling, Testing.

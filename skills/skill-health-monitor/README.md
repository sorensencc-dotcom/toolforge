# skill-health-monitor

Ecosystem health from real `manifest.json` data: staleness, never-run skills, and manifest/directory drift.

## Quick Start

```bash
npm test
npm run health-check -- --staleDays 30
```

## What it does

- Audits `manifest.json` against actual `skills/` directory listing
- Reports staleness and never-run skills
- Identifies orphaned manifest entries and unregistered directories
- Calculates health score (100 - penalties for drift/staleness)
- Provides actionable recommendations

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

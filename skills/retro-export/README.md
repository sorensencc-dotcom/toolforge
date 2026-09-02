# retro-export

Thin wrapper that exports gstack `/retro` metrics as JSON schema v1.0.

`/retro` is an external, prompt-only gstack skill and isn't modifiable directly.
This skill accepts the metrics it produces and writes them to a stable JSON
file for downstream tooling (dashboards, reporting agents) to consume.

## Quick Start

```bash
npm run build
node -e "require('./dist/index').exportRetroJson({testsRun: 12, testsPassed: 11, blockers: [], workSummary: 'session summary'})"
```

## What it does

- Accepts `testsRun`, `testsPassed`, `blockers`, `workSummary`
- Writes JSON schema v1.0 to `%APPDATA%\Claude\retro-export.json` (Windows)
  or `~/.config/Claude/retro-export.json` (macOS/Linux)
- Never throws on export failure — returns `{ success: false, error }` instead

## Schema v1.0

```json
{
  "version": "1.0",
  "timestamp": "ISO 8601",
  "tests_run": 0,
  "tests_passed": 0,
  "blockers": [],
  "work_summary": ""
}
```

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

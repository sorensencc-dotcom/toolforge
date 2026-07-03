# Work-Summarizer Usage Guide

## Quick Start

```bash
cd C:\dev\toolforge\skills\work-summarizer
npm install
npm run build
node dist/index.js
```

## Running via Claude Code Skill Runner

```bash
node C:\dev\CIP\CIC\automation\skill-runner.js work-summarizer-daily "C:\dev\CIP\CIC\logs\skill-executions"
node C:\dev\CIP\CIC\automation\skill-runner.js work-summarizer-weekly "C:\dev\CIP\CIC\logs\skill-executions"
```

## Scheduled Execution

Task Scheduler jobs are pre-configured:
- Daily: 09:00 UTC via `CIC-Skill-WorkSummarizer-Daily`
- Weekly (Mon): 10:00 UTC via `CIC-Skill-WorkSummarizer-Weekly`

Logs written to: `C:\dev\CIP\CIC\logs\work-summaries\`

## API Integration

```typescript
import run from './dist/index.js';

// Daily report
const daily = await run({ mode: 'daily' });

// Weekly report with routing artifact
const weekly = await run({
  mode: 'weekly',
  includeRoutingArtifact: true
});

// With LLM reasoning (requires ANTHROPIC_API_KEY env var)
const enhanced = await run({
  mode: 'weekly',
  reasoningEnabled: true,
  anthropicModel: 'claude-opus-4-1',
  reasoningTimeoutMs: 30000
});

if (enhanced.status === 'ok') {
  console.log(`Generated report: ${enhanced.data.period}`);
  console.log(`Categories: ${Object.keys(enhanced.data.work_by_category).length}`);
  console.log(`Drift signals: ${enhanced.data.drift_signals.count}`);
}
```

## Output Files

### Daily Reports
- `work-summary-daily-YYYY-MM-DD.json` — Structured report (v3.0.0 schema)
- `work-summary-daily-YYYY-MM-DD.txt` — Plaintext summary

### Weekly Reports
- `work-summary-weekly-YYYY-MM-DD.json` — Aggregated 7-day report
- `work-summary-weekly-YYYY-MM-DD.txt` — Plaintext summary
- `work-summary.artifact.json` — MAAL routing artifact (if `includeRoutingArtifact: true`)

## Schema Versioning

### v3.0.0 Fields

**New in v3.0.0:**
- `schema_version: "3.0.0"`
- `subsystem_impacts[]` — Per-subsystem LLM analysis (if reasoning enabled)
- `cross_repo_impacts[]` — Dependency graph analysis
- `transcript_excerpts[]` — Activity-related code/message snippets
- `transcript_sessions_scanned` — Real count (was hardcoded 0 in v2)
- `repo_deltas[].lines_added`, `lines_deleted`, `active_subsystems` — Real values

**Changed in v3.0.0:**
- `notable_changes[]`: `string[]` → `{ file, risk_level, subsystems }[]`

**Backward Compatibility:**
- `work_by_category` remains flat `Record<string, number>` for external consumers
- Old v2 reports trigger forced full rescan during weekly aggregation

## Troubleshooting

### No output files generated
- Check `C:\dev\repo-registry.json` exists and contains repos
- Verify repos in registry actually exist on disk
- Check output directory is writable

### Weekly aggregation falls back to full scan
- Expected if < 50% of last 7 daily reports available
- Check `work-summary-daily-*.json` files exist in output directory
- Verify their `schema_version >= 3.0.0`

### LLM reasoning disabled despite `reasoningEnabled: true`
- Check `ANTHROPIC_API_KEY` env var is set
- Verify it's visible to Windows Task Scheduler (may need machine-level env var, not shell)
- Check skill logs for "reasoning_source": "fallback" (indicates API key issue)

### Task Scheduler job not firing
- Verify job exists: `Get-ScheduledTask -TaskPath "\CIC\Skills\" -TaskName "CIC-Skill-WorkSummarizer-Daily"`
- Check Task Scheduler history for failures
- Verify Node.js path is correct in job definition
- Ensure `ANTHROPIC_API_KEY` is set in task environment if reasoning enabled

## Monitoring

Check latest execution:

```powershell
Get-ChildItem "C:\dev\CIP\CIC\logs\work-summaries" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 2
```

Inspect report structure:

```powershell
$report = Get-Content "C:\dev\CIP\CIC\logs\work-summaries\work-summary-daily-2026-07-02.json" | ConvertFrom-Json
$report | Select-Object -ExpandProperty work_by_category | Format-Table
```

## Testing

```bash
npm test
```

Test matrix covers:
- Category-map regression (exact 17 names)
- Dependency-graph integrity checks
- Weekly aggregator schema-version gating
- Claude reasoning provider (mocked)
- Fallback-only scenarios (no API key, no activity)

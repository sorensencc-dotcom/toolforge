# automation-audit — Usage

## Scan the current repo

```ts
import runAutomationAudit from "../src/index";

const report = runAutomationAudit({ repoRoot: "C:\\dev" });
console.log(report.totalOpportunities, report.byPriority);
```

## CLI

```bash
npx ts-node src/index.ts
```

## Custom thresholds

```ts
runAutomationAudit({
  repoRoot: "C:\\dev\\toolforge",
  logSizeMB: 25,
  backupItemThreshold: 20,
  manualMarkerPattern: /\b(FIXME|manual)\b/i,
  excludeDirs: ["node_modules", ".git", "dist", "build", "coverage"],
});
```

## Reading the report

- `byPriority.high` — oversized logs (>5x threshold) worth automating first.
- `opportunities[].path` is relative to `repoRoot`.
- Report is a snapshot — re-run and diff over time rather than acting on one pass.

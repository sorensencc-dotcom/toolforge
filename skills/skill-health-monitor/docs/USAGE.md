# skill-health-monitor — Usage

## Default run (from repo root)

```ts
import runSkillHealthMonitor from "../src/index";

const report = runSkillHealthMonitor({ cwd: "C:\\dev" });
console.log(report.healthScore, report.recommendations);
```

## CLI

```bash
npx ts-node src/index.ts
# exits 1 if healthScore < 60
```

## Custom manifest / staleness window

```ts
runSkillHealthMonitor({
  manifestPath: "toolforge/manifest.json",
  skillsDir: "toolforge/skills",
  staleDays: 14,
});
```

## Reading orphaned vs unregistered

- `orphanedManifestEntries` — manifest says the skill exists; the directory doesn't.
  Usually means a skill was deleted without updating `manifest.json`.
- `unregisteredDirs` — the directory exists; manifest.json has no entry.
  Usually means a new skill was scaffolded but never registered.

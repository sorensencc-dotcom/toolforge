import { spawnSync } from "node:child_process"; // noqa: SEC-AUDITOR -- reviewed fixed Node executable + installed tsx CLI, literal test paths, shell:false; see scripts/README.md.
import { globSync } from "node:fs";
import { createRequire } from "node:module";

// Default suite: every src/**/*.test.ts EXCEPT the live smoke test, which hits
// the real Parallel API and must never run in default CI (design spec, defect 7).
const EXPECTED_MIN = 35;
const files = globSync("src/**/*.test.ts").filter(f => !f.endsWith(".smoke.test.ts"));
if (files.length === 0) {
  console.error("No test files matched src/**/*.test.ts. A suite was silently dropped.");
  process.exit(1);
}
let cli;
try { cli = createRequire(import.meta.url).resolve("tsx/cli"); }
catch {
  console.error("Installed tsx runtime unavailable. Provision dependencies explicitly before testing.");
  process.exit(1);
}
const result = spawnSync(process.execPath, [cli, "--test", ...files], { encoding: "utf8", shell: false, windowsHide: true });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error || result.signal || result.status === null) {
  console.error("Local test runtime failed to complete.");
  process.exit(1);
}
const match = result.stdout.match(/# tests (\d+)/) ?? result.stdout.match(/ℹ tests (\d+)/);
const count = match ? Number(match[1]) : 0;
if (count < EXPECTED_MIN) {
  console.error(`Expected at least ${EXPECTED_MIN} tests, node:test reported ${count}. A suite was silently dropped.`);
  process.exit(1);
}
process.exit(result.status);

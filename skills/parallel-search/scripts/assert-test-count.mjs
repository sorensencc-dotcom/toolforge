import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";

// Default suite: every src/**/*.test.ts EXCEPT the live smoke test, which hits
// the real Parallel API and must never run in default CI (design spec, defect 7).
const EXPECTED_MIN = 35;
const files = globSync("src/**/*.test.ts").filter(f => !f.endsWith(".smoke.test.ts"));
if (files.length === 0) {
  console.error("No test files matched src/**/*.test.ts. A suite was silently dropped.");
  process.exit(1);
}
const result = spawnSync("npx", ["tsx", "--test", ...files], { encoding: "utf8", shell: true });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
const match = result.stdout.match(/# tests (\d+)/) ?? result.stdout.match(/ℹ tests (\d+)/);
const count = match ? Number(match[1]) : 0;
if (count < EXPECTED_MIN) {
  console.error(`Expected at least ${EXPECTED_MIN} tests, node:test reported ${count}. A suite was silently dropped.`);
  process.exit(1);
}
process.exit(result.status ?? 0);

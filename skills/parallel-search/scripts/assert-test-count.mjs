import { spawnSync } from "node:child_process";

const EXPECTED_MIN = 11;
const result = spawnSync("npx", ["tsx", "--test", "src/**/*.test.ts"], { encoding: "utf8", shell: true });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
const match = result.stdout.match(/# tests (\d+)/) ?? result.stdout.match(/ℹ tests (\d+)/);
const count = match ? Number(match[1]) : 0;
if (count < EXPECTED_MIN) {
  console.error(`Expected at least ${EXPECTED_MIN} tests, node:test reported ${count}. A suite was silently dropped.`);
  process.exit(1);
}
process.exit(result.status ?? 0);

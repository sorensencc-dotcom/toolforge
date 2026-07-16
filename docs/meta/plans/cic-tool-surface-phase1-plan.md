# CIC Tool Surface Phase 1 Implementation Plan

> **For agentic workers:** This plan is executed by an external agent (Codex),
> not via superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with a commit.

**Goal:** Build 4 Toolforge skills (`cic-ingest-world`, `cic-run-gate`,
`cic-repair-pipeline`, `cic-consolidate-artifacts`) plus a shared helper
module and a Python gate adapter, implementing the CIC Tool Surface Phase 1
contract.

**Architecture:** Each skill is a standalone Node/TS Toolforge skill
(`skill.json` + `manifest.json` entry + `src/index.ts` exporting `main(input)`
+ `tests/`), matching the existing `skills/analyze-token-burn` shape exactly.
Three skills are stubs (no external calls). `cic-run-gate` is real: it spawns
a Python adapter (`CIC-GOVERNANCE/adapters/run_gate_adapter.py`) that drives
GATE-01's existing `unittest.TestCase` mechanics and returns one JSON line.

**Tech Stack:** Node/TypeScript (jest, ts-jest, TypeScript 5), Python 3.12
stdlib only (`unittest`, `json`, `subprocess` on the Node side via
`child_process.spawn`).

## Global Constraints

- Every output object includes `runId` (or `bundleId` for consolidate) and
  ISO-8601 `timestamp`.
- Every skill writes its result JSON to `/cic/artifacts/<kind>/<runId>/result.json`
  via the shared `writeResultJson` helper — no skill writes artifacts directly.
- `cic-run-gate` supports `gateId="GATE-01"` only. Any other `gateId` is a
  normal `ERROR` result (not a thrown error, not a non-zero skill exit).
- No new external npm/pip dependencies. Match `skills/analyze-token-burn`'s
  existing `devDependencies` exactly (jest ^29.5.0, ts-jest ^29.1.0,
  typescript ^5.0.0, @types/jest ^29.5.0, @types/node ^20.0.0).
- `skill.json` for every new skill sets `integrations.cowork.registered: false`,
  `status: "pending_registration"` — these are not marketplace-submitted in
  Phase 1.
- Spec of record: `C:\dev\docs\meta\cic-tool-surface-phase1-design.md`. If any
  task here conflicts with it, the spec wins — flag the conflict instead of
  silently picking one.

---

## File Structure

```
skills/_cic-shared/
  src/runId.ts             — generateRunId(), generateBundleId()
  src/artifactPaths.ts      — artifactPaths(kind, runId) -> { dir, resultFile }
  src/writeResultJson.ts    — writeResultJson(kind, runId, payload) -> Promise<string>
  tests/shared.test.ts
  package.json, tsconfig.json, jest.config.js  (copied from analyze-token-burn, name changed)

skills/cic-ingest-world/
  skill.json, manifest entry in root manifest.json
  src/index.ts
  tests/skill.test.ts
  docs/USAGE.md

skills/cic-repair-pipeline/      (same shape as cic-ingest-world)
skills/cic-consolidate-artifacts/ (same shape as cic-ingest-world)

skills/cic-run-gate/
  skill.json, manifest entry
  src/index.ts               — spawns the Python adapter
  tests/skill.test.ts
  docs/USAGE.md

CIC-GOVERNANCE/adapters/run_gate_adapter.py
CIC-GOVERNANCE/adapters/tests/test_run_gate_adapter.py
```

`_cic-shared` is built first — every other skill imports it by relative path
(`../../_cic-shared/src/...`). The three stub skills are structurally
identical (different field names only) — build `cic-ingest-world` first as
the reference, then `cic-repair-pipeline` and `cic-consolidate-artifacts`
follow the same pattern. `cic-run-gate` is last because it depends on the
Python adapter.

---

### Task 1: `_cic-shared` helper module

**Files:**
- Create: `skills/_cic-shared/package.json`
- Create: `skills/_cic-shared/tsconfig.json`
- Create: `skills/_cic-shared/jest.config.js`
- Create: `skills/_cic-shared/src/runId.ts`
- Create: `skills/_cic-shared/src/artifactPaths.ts`
- Create: `skills/_cic-shared/src/writeResultJson.ts`
- Test: `skills/_cic-shared/tests/shared.test.ts`

**Interfaces:**
- Produces:
  - `generateRunId(): string` — format `run-<ISO8601-compact>-<6-hex>`, e.g. `run-20260716T143022Z-a1b2c3`
  - `generateBundleId(): string` — format `bundle-<ISO8601-compact>-<6-hex>`
  - `artifactPaths(kind: string, id: string): { dir: string; resultFile: string }` — `dir` is `/cic/artifacts/<kind>/<id>`, `resultFile` is `<dir>/result.json`, both relative to `process.cwd()` (repo root) — i.e. actual path used is `path.join(process.cwd(), 'cic', 'artifacts', kind, id)` (no leading slash — Windows has no `/cic` root; document this explicitly as a spec deviation, see Note below)
  - `writeResultJson(kind: string, id: string, payload: Record<string, unknown>): Promise<string>` — creates the dir (`fs.mkdir(recursive: true)`), writes `JSON.stringify(payload, null, 2)` to `resultFile`, returns `resultFile`

**Note (spec deviation, intentional):** The spec writes paths as `/cic/artifacts/...`
(POSIX-absolute). This repo runs on Windows; there is no `/cic` volume root.
`artifactPaths` resolves under `<repo-root>/cic/artifacts/...` instead. Every
skill's output fields (`artifactsPath`, `reportPath`, `bundlePath`,
`patchSetPath`) must use this same relative-to-repo-root convention. Mention
this in each skill's `docs/USAGE.md`.

- [ ] **Step 1: Create shared package scaffold**

`skills/_cic-shared/package.json`:
```json
{
  "name": "_cic-shared",
  "version": "1.0.0",
  "description": "Shared helpers for CIC tool surface skills",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  }
}
```

`skills/_cic-shared/tsconfig.json` (copy of `skills/analyze-token-burn/tsconfig.json` verbatim).

`skills/_cic-shared/jest.config.js` (copy of `skills/analyze-token-burn/jest.config.js` verbatim).

- [ ] **Step 2: Write failing tests**

`skills/_cic-shared/tests/shared.test.ts`:
```ts
import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { generateRunId, generateBundleId } from '../src/runId';
import { artifactPaths } from '../src/artifactPaths';
import { writeResultJson } from '../src/writeResultJson';

describe('runId', () => {
  it('generateRunId matches run-<compact-iso>-<6hex>', () => {
    const id = generateRunId();
    expect(id).toMatch(/^run-\d{8}T\d{6}Z-[0-9a-f]{6}$/);
  });

  it('generateBundleId matches bundle-<compact-iso>-<6hex>', () => {
    const id = generateBundleId();
    expect(id).toMatch(/^bundle-\d{8}T\d{6}Z-[0-9a-f]{6}$/);
  });

  it('generateRunId produces unique values', () => {
    const a = generateRunId();
    const b = generateRunId();
    expect(a).not.toBe(b);
  });
});

describe('artifactPaths', () => {
  it('builds dir and resultFile under cic/artifacts/<kind>/<id>', () => {
    const { dir, resultFile } = artifactPaths('gates', 'run-test-1');
    expect(dir).toBe(path.join(process.cwd(), 'cic', 'artifacts', 'gates', 'run-test-1'));
    expect(resultFile).toBe(path.join(dir, 'result.json'));
  });
});

describe('writeResultJson', () => {
  const kind = 'test-kind';
  const id = 'run-write-test';

  afterEach(() => {
    const dir = artifactPaths(kind, id).dir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes payload to resultFile and returns its path', async () => {
    const payload = { runId: id, status: 'stub', timestamp: new Date().toISOString() };
    const written = await writeResultJson(kind, id, payload);
    expect(written).toBe(artifactPaths(kind, id).resultFile);
    const onDisk = JSON.parse(fs.readFileSync(written, 'utf-8'));
    expect(onDisk).toEqual(payload);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd skills/_cic-shared && npm install && npx jest`
Expected: FAIL — `Cannot find module '../src/runId'` (and siblings) since none exist yet.

- [ ] **Step 4: Implement**

`skills/_cic-shared/src/runId.ts`:
```ts
import * as crypto from 'crypto';

function compactIso(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hex6(): string {
  return crypto.randomBytes(3).toString('hex');
}

export function generateRunId(): string {
  return `run-${compactIso()}-${hex6()}`;
}

export function generateBundleId(): string {
  return `bundle-${compactIso()}-${hex6()}`;
}
```

`skills/_cic-shared/src/artifactPaths.ts`:
```ts
import * as path from 'path';

export interface ArtifactPaths {
  dir: string;
  resultFile: string;
}

export function artifactPaths(kind: string, id: string): ArtifactPaths {
  const dir = path.join(process.cwd(), 'cic', 'artifacts', kind, id);
  return { dir, resultFile: path.join(dir, 'result.json') };
}
```

`skills/_cic-shared/src/writeResultJson.ts`:
```ts
import * as fs from 'fs/promises';
import { artifactPaths } from './artifactPaths';

export async function writeResultJson(
  kind: string,
  id: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { dir, resultFile } = artifactPaths(kind, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resultFile, JSON.stringify(payload, null, 2), 'utf-8');
  return resultFile;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd skills/_cic-shared && npx jest`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add skills/_cic-shared
git commit -m "feat(cic-tool-surface): add _cic-shared helper module"
```

---

### Task 2: `cic-ingest-world` stub skill

**Files:**
- Create: `skills/cic-ingest-world/skill.json`
- Create: `skills/cic-ingest-world/package.json`, `tsconfig.json`, `jest.config.js` (copy pattern from Task 1)
- Create: `skills/cic-ingest-world/src/index.ts`
- Test: `skills/cic-ingest-world/tests/skill.test.ts`
- Create: `skills/cic-ingest-world/docs/USAGE.md`
- Modify: `manifest.json:` (root) — append skill entry

**Interfaces:**
- Consumes: `generateRunId` and `writeResultJson` from `../../_cic-shared/src/runId` and `../../_cic-shared/src/writeResultJson` (Task 1)
- Produces: `main(input: IngestInput): Promise<IngestOutput>` where
  ```ts
  interface IngestInput { sourceId: string; schemaRef?: string; targetSystem?: string }
  interface IngestOutput {
    runId: string; status: 'stub'; artifactsPath: string; lineageRef: string; timestamp: string;
  }
  ```

- [ ] **Step 1: Write failing test**

`skills/cic-ingest-world/tests/skill.test.ts`:
```ts
import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('cic-ingest-world', () => {
  it('returns stub result with required fields', async () => {
    const result = await main({ sourceId: 'demo-source' });
    expect(result.status).toBe('stub');
    expect(result.runId).toMatch(/^run-/);
    expect(typeof result.artifactsPath).toBe('string');
    expect(typeof result.lineageRef).toBe('string');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });

  it('reflects sourceId into lineageRef', async () => {
    const result = await main({ sourceId: 'demo-source' });
    expect(result.lineageRef).toContain('demo-source');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/cic-ingest-world && npm install && npx jest`
Expected: FAIL — `Cannot find module '../src/index'`.

- [ ] **Step 3: Implement**

`skills/cic-ingest-world/src/index.ts`:
```ts
import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';

export interface IngestInput {
  sourceId: string;
  schemaRef?: string;
  targetSystem?: string;
}

export interface IngestOutput {
  runId: string;
  status: 'stub';
  artifactsPath: string;
  lineageRef: string;
  timestamp: string;
}

export async function main(input: IngestInput): Promise<IngestOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('ingest', runId);
  const result: IngestOutput = {
    runId,
    status: 'stub',
    artifactsPath: dir,
    lineageRef: `lineage:ingest:${input.sourceId}:${runId}`,
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('ingest', runId, result);
  return result;
}

export default main;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/cic-ingest-world && npx jest`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add skill.json**

`skills/cic-ingest-world/skill.json`:
```json
{
  "id": "cic-ingest-world",
  "name": "CIC Ingest World",
  "version": "1.0.0",
  "description": "Stub: ingest a world/source into CIC (Phase 1 placeholder, no TorqueQuery yet)",
  "category": "governance",
  "triggers": ["cic-ingest-world", "cic ingest"],
  "role": "ops",
  "runtime": "node",
  "entrypoint": "src/index.ts",
  "integrations": {
    "cowork": {
      "registered": false,
      "pluginType": "skill",
      "icon": "database",
      "registrationPath": "cowork://toolforge/skills/cic-ingest-world",
      "status": "pending_registration"
    }
  },
  "tooltip": "Stub CIC world ingestion tool"
}
```

`skills/cic-ingest-world/docs/USAGE.md`:
```markdown
# cic-ingest-world

Phase 1 stub. Returns a fabricated ingest result — no real ingestion runs.
Real backend deferred until TorqueQuery (`rewrite-docs/services/torquequery/`)
is committed and stable. See `C:\dev\docs\meta\cic-tool-surface-phase1-design.md`.

Paths in output (`artifactsPath`) are relative to repo root
(`<repo-root>/cic/artifacts/...`), not POSIX-absolute `/cic/...` as in the
original plan text — this repo runs on Windows.

## Input
`{ sourceId: string; schemaRef?: string; targetSystem?: string }`

## Output
`{ runId, status: "stub", artifactsPath, lineageRef, timestamp }`
```

- [ ] **Step 6: Register in root manifest.json**

Read `manifest.json`, append to the `skills` array (following the exact
shape of the `analyze-token-burn` entry read earlier in this session):
```json
{
  "version": "1.0.0",
  "description": "Stub: ingest a world/source into CIC (Phase 1 placeholder, no TorqueQuery yet)",
  "timestamps": { "created": "<ISO8601 now>", "lastValidation": null, "lastRun": null },
  "tags": ["cic", "governance", "phase1"],
  "status": "active",
  "name": "cic-ingest-world",
  "runtime": "node",
  "id": "cic-ingest-world",
  "entrypoint": "src/index.ts",
  "owner": "soren",
  "category": "governance",
  "health": { "canonical": true, "runtime": "untested", "distributed": false, "overall": "good" },
  "dependencies": { "external": [], "internal": ["_cic-shared"] }
}
```

- [ ] **Step 7: Commit**

```bash
git add skills/cic-ingest-world manifest.json
git commit -m "feat(cic-tool-surface): add cic-ingest-world stub skill"
```

---

### Task 3: `cic-repair-pipeline` stub skill

Same shape as Task 2. Differences only:

**Interfaces:**
```ts
interface RepairInput { pipelineId: string; failureContext?: string }
interface RepairOutput {
  runId: string; status: 'stub'; patchSetPath: string; commands: string[]; timestamp: string;
}
```

- [ ] **Step 1: Write failing test** — `skills/cic-repair-pipeline/tests/skill.test.ts`:
```ts
import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('cic-repair-pipeline', () => {
  it('returns stub result with required fields', async () => {
    const result = await main({ pipelineId: 'demo-pipeline' });
    expect(result.status).toBe('stub');
    expect(result.runId).toMatch(/^run-/);
    expect(typeof result.patchSetPath).toBe('string');
    expect(Array.isArray(result.commands)).toBe(true);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd skills/cic-repair-pipeline && npm install && npx jest` → FAIL, module not found.

- [ ] **Step 3: Implement** — `skills/cic-repair-pipeline/src/index.ts`:
```ts
import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';

export interface RepairInput {
  pipelineId: string;
  failureContext?: string;
}

export interface RepairOutput {
  runId: string;
  status: 'stub';
  patchSetPath: string;
  commands: string[];
  timestamp: string;
}

export async function main(input: RepairInput): Promise<RepairOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('repair', runId);
  const result: RepairOutput = {
    runId,
    status: 'stub',
    patchSetPath: `${dir}/patchset.json`,
    commands: [],
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('repair', runId, result);
  return result;
}

export default main;
```

- [ ] **Step 4: Run test to verify it passes** — `cd skills/cic-repair-pipeline && npx jest` → PASS, 1 test.

- [ ] **Step 5: Add skill.json** (same shape as Task 2 Step 5, `id`/`name`/`description`/`icon: "wrench"` swapped for repair) and `docs/USAGE.md` (same disclaimer, input/output for Repair).

- [ ] **Step 6: Register in root `manifest.json`** (same shape as Task 2 Step 6, fields swapped for repair).

- [ ] **Step 7: Commit**
```bash
git add skills/cic-repair-pipeline manifest.json
git commit -m "feat(cic-tool-surface): add cic-repair-pipeline stub skill"
```

---

### Task 4: `cic-consolidate-artifacts` stub skill

Same shape again.

**Interfaces:**
```ts
interface ConsolidateInput { runIds: string[]; profile?: string }
interface ConsolidateOutput {
  bundleId: string; status: 'stub'; bundlePath: string; timestamp: string;
}
```

- [ ] **Step 1: Write failing test** — `skills/cic-consolidate-artifacts/tests/skill.test.ts`:
```ts
import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('cic-consolidate-artifacts', () => {
  it('returns stub result with required fields', async () => {
    const result = await main({ runIds: ['run-a', 'run-b'] });
    expect(result.status).toBe('stub');
    expect(result.bundleId).toMatch(/^bundle-/);
    expect(typeof result.bundlePath).toBe('string');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd skills/cic-consolidate-artifacts && npm install && npx jest` → FAIL.

- [ ] **Step 3: Implement** — `skills/cic-consolidate-artifacts/src/index.ts`:
```ts
import { generateBundleId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';

export interface ConsolidateInput {
  runIds: string[];
  profile?: string;
}

export interface ConsolidateOutput {
  bundleId: string;
  status: 'stub';
  bundlePath: string;
  timestamp: string;
}

export async function main(input: ConsolidateInput): Promise<ConsolidateOutput> {
  const bundleId = generateBundleId();
  const { dir } = artifactPaths('consolidate', bundleId);
  const result: ConsolidateOutput = {
    bundleId,
    status: 'stub',
    bundlePath: `${dir}/bundle.json`,
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('consolidate', bundleId, result);
  return result;
}

export default main;
```

- [ ] **Step 4: Run test to verify it passes** — `cd skills/cic-consolidate-artifacts && npx jest` → PASS, 1 test.

- [ ] **Step 5: Add skill.json** (`icon: "package"`) and `docs/USAGE.md`.

- [ ] **Step 6: Register in root `manifest.json`**.

- [ ] **Step 7: Commit**
```bash
git add skills/cic-consolidate-artifacts manifest.json
git commit -m "feat(cic-tool-surface): add cic-consolidate-artifacts stub skill"
```

---

### Task 5: `run_gate_adapter.py` — Python gate adapter

This is the one real (non-stub) piece of logic. It must:
1. Only handle `GATE-01`.
2. Distinguish a genuine test **FAIL** (assertion failed — a real gate
   violation) from a test **ERROR** (exception in the test itself — the
   adapter/harness is broken, not the gate). This was flagged in code review
   of the earlier draft — `unittest`'s default `TestResult` conflates both
   into "not successful"; this task keeps them separate per-test.
3. Never raise past `main()` — always print exactly one JSON line and exit 0.

**Files:**
- Create: `CIC-GOVERNANCE/adapters/run_gate_adapter.py`
- Test: `CIC-GOVERNANCE/adapters/tests/test_run_gate_adapter.py`
- Modify: none (imports `Gate01TransactionTests` from existing `CIC-GOVERNANCE/tests/test_gate_runtime.py`)

**Interfaces:**
- Produces (stdout, one JSON line):
  ```json
  {
    "status": "PASS" | "FAIL" | "ERROR",
    "violations": [{"testId": "...", "description": "...", "outcome": "FAIL" | "ERROR"}],
    "message": "..."
  }
  ```
  (Task 6's TS wrapper adds `runId`, `gateId`, `reportPath`, `artifactsPath`, `timestamp` around this.)

- [ ] **Step 1: Write failing test**

`CIC-GOVERNANCE/adapters/tests/test_run_gate_adapter.py`:
```python
import json
import subprocess
import sys
from pathlib import Path

ADAPTER = Path(__file__).resolve().parents[1] / "run_gate_adapter.py"
CWD = Path(__file__).resolve().parents[2]  # CIC-GOVERNANCE/


def run_adapter(gate_id: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(ADAPTER), gate_id],
        cwd=CWD,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, f"adapter exited {proc.returncode}, stderr: {proc.stderr}"
    lines = [l for l in proc.stdout.splitlines() if l.strip()]
    assert len(lines) == 1, f"expected exactly one stdout line, got: {proc.stdout!r}"
    return json.loads(lines[0])


def test_gate01_returns_pass_or_fail_shape():
    payload = run_adapter("GATE-01")
    assert payload["status"] in ("PASS", "FAIL", "ERROR")
    assert isinstance(payload["violations"], list)
    assert isinstance(payload["message"], str)
    for v in payload["violations"]:
        assert set(v.keys()) == {"testId", "description", "outcome"}
        assert v["outcome"] in ("FAIL", "ERROR")


def test_unknown_gate_returns_structured_error():
    payload = run_adapter("GATE-99")
    assert payload == {
        "status": "ERROR",
        "violations": [],
        "message": "gate not wired",
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd CIC-GOVERNANCE && python -m pytest adapters/tests/test_run_gate_adapter.py -v`
Expected: FAIL — `run_gate_adapter.py` does not exist (`FileNotFoundError` inside `subprocess.run`, surfaced as a test error).

- [ ] **Step 3: Implement**

`CIC-GOVERNANCE/adapters/run_gate_adapter.py`:
```python
"""Phase 1 CIC gate adapter. Wraps GATE-01 unittest mechanics as one JSON line on stdout."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests"))

from test_gate_runtime import Gate01TransactionTests  # noqa: E402


class JsonCollectingResult(unittest.TestResult):
    def __init__(self) -> None:
        super().__init__()
        self._outcomes: list[dict] = []

    def addSuccess(self, test) -> None:
        super().addSuccess(test)
        self._outcomes.append(
            {"testId": test.id(), "description": test.shortDescription() or "", "outcome": "PASS"}
        )

    def addFailure(self, test, err) -> None:
        super().addFailure(test, err)
        self._outcomes.append(
            {"testId": test.id(), "description": test.shortDescription() or "", "outcome": "FAIL"}
        )

    def addError(self, test, err) -> None:
        super().addError(test, err)
        self._outcomes.append(
            {"testId": test.id(), "description": test.shortDescription() or "", "outcome": "ERROR"}
        )

    def violations_as_json(self) -> list[dict]:
        return [o for o in self._outcomes if o["outcome"] != "PASS"]


def run_unittest_case(case_cls) -> dict:
    result = JsonCollectingResult()
    unittest.TestLoader().loadTestsFromTestCase(case_cls).run(result)
    violations = result.violations_as_json()
    any_error = any(v["outcome"] == "ERROR" for v in violations)
    if any_error:
        status = "ERROR"
        message = "one or more tests errored (harness fault, not a confirmed violation)"
    elif violations:
        status = "FAIL"
        message = "violations present"
    else:
        status = "PASS"
        message = "all tests passed"
    return {"status": status, "violations": violations, "message": message}


GATE_HANDLERS: dict[str, Callable[[], dict]] = {
    "GATE-01": lambda: run_unittest_case(Gate01TransactionTests),
}


def main(gate_id: str) -> None:
    handler = GATE_HANDLERS.get(gate_id)
    if handler is None:
        payload = {"status": "ERROR", "violations": [], "message": "gate not wired"}
    else:
        try:
            payload = handler()
        except Exception as exc:  # adapter-level failure, still one JSON line, exit 0
            payload = {"status": "ERROR", "violations": [], "message": f"adapter exception: {exc}"}
    print(json.dumps(payload))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd CIC-GOVERNANCE && python -m pytest adapters/tests/test_run_gate_adapter.py -v`
Expected: PASS, 2 tests. (If `test_gate01_returns_pass_or_fail_shape` reveals GATE-01 mechanics
actually FAIL/ERROR against current `governance_runtime.py` state, that is real
signal, not a plan defect — do not alter the adapter to force PASS. Report the
actual status to the user instead of silently patching around it.)

- [ ] **Step 5: Commit**

```bash
git add CIC-GOVERNANCE/adapters
git commit -m "feat(cic-tool-surface): add run_gate_adapter.py for GATE-01"
```

---

### Task 6: `cic-run-gate` TS skill

**Files:**
- Create: `skills/cic-run-gate/skill.json`
- Create: `skills/cic-run-gate/package.json`, `tsconfig.json`, `jest.config.js`
- Create: `skills/cic-run-gate/src/index.ts`
- Test: `skills/cic-run-gate/tests/skill.test.ts`
- Create: `skills/cic-run-gate/docs/USAGE.md`
- Modify: `manifest.json`

**Interfaces:**
- Consumes:
  - `generateRunId`, `writeResultJson`, `artifactPaths` from `_cic-shared` (Task 1)
  - Adapter contract from Task 5: spawns `python CIC-GOVERNANCE/adapters/run_gate_adapter.py <gateId>`, cwd `CIC-GOVERNANCE/`, expects one JSON line `{status, violations, message}` on stdout.
- Produces:
  ```ts
  interface RunGateInput { gateId: string; scope?: string; profile?: string }
  interface RunGateOutput {
    runId: string; gateId: string; status: 'PASS' | 'FAIL' | 'ERROR';
    violations: { testId: string; description: string; outcome: string }[];
    reportPath: string; artifactsPath: string; message: string; timestamp: string;
  }
  ```

Two fixes from code review baked into this task's implementation:
- **gateId allowlist**: validated against `/^GATE-\d{2}$/` *before* spawning
  — an unvalidated string reaching `spawn()` argv is inert (no shell, no
  injection risk with array-form `spawn`), but rejecting it early avoids
  spawning a process for input that can never resolve.
- **Subprocess timeout**: 15s; on timeout the skill returns `status: "ERROR"`
  instead of hanging.
- `reportPath` is real: this skill (not the Python adapter) writes the full
  adapter payload to `<artifactsPath>/report.json` before writing the top-level
  result via `writeResultJson`, so `reportPath` always points at something
  that exists on disk.
- `scope`/`profile` inputs are accepted for contract-forward-compatibility
  (spec's shape) but are not yet consumed by `GATE_HANDLERS` (GATE-01's
  mechanics don't take scope/profile parameters) — documented as a known gap
  in `docs/USAGE.md`, not silently dropped without a trace.

- [ ] **Step 1: Write failing test**

`skills/cic-run-gate/tests/skill.test.ts`:
```ts
import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('cic-run-gate', () => {
  it('GATE-01 returns a well-formed PASS/FAIL/ERROR result', async () => {
    const result = await main({ gateId: 'GATE-01' });
    expect(result.gateId).toBe('GATE-01');
    expect(['PASS', 'FAIL', 'ERROR']).toContain(result.status);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(typeof result.reportPath).toBe('string');
    expect(typeof result.artifactsPath).toBe('string');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  }, 20000);

  it('unknown gateId shape (GATE-99) returns ERROR without spawning', async () => {
    const result = await main({ gateId: 'GATE-99' });
    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual([]);
  });

  it('malformed gateId is rejected before spawn', async () => {
    const result = await main({ gateId: 'not-a-gate; rm -rf /' });
    expect(result.status).toBe('ERROR');
    expect(result.message).toMatch(/invalid gateId/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/cic-run-gate && npm install && npx jest`
Expected: FAIL — `Cannot find module '../src/index'`.

- [ ] **Step 3: Implement**

`skills/cic-run-gate/src/index.ts`:
```ts
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';

export interface RunGateInput {
  gateId: string;
  scope?: string;
  profile?: string;
}

interface AdapterPayload {
  status: 'PASS' | 'FAIL' | 'ERROR';
  violations: { testId: string; description: string; outcome: string }[];
  message: string;
}

export interface RunGateOutput extends AdapterPayload {
  runId: string;
  gateId: string;
  reportPath: string;
  artifactsPath: string;
  timestamp: string;
}

const GATE_ID_PATTERN = /^GATE-\d{2}$/;
const ADAPTER_PATH = path.resolve(__dirname, '../../../CIC-GOVERNANCE/adapters/run_gate_adapter.py');
const ADAPTER_CWD = path.resolve(__dirname, '../../../CIC-GOVERNANCE');
const SPAWN_TIMEOUT_MS = 15000;

function runAdapter(gateId: string): Promise<AdapterPayload> {
  return new Promise((resolve) => {
    const child = spawn('python', [ADAPTER_PATH, gateId], { cwd: ADAPTER_CWD });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ status: 'ERROR', violations: [], message: 'adapter timed out' });
    }, SPAWN_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ status: 'ERROR', violations: [], message: `adapter exited ${code}: ${stderr.trim()}` });
        return;
      }
      try {
        const line = stdout.trim().split('\n').filter(Boolean)[0] ?? '';
        resolve(JSON.parse(line));
      } catch {
        resolve({ status: 'ERROR', violations: [], message: 'adapter produced invalid JSON' });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ status: 'ERROR', violations: [], message: `failed to spawn adapter: ${err.message}` });
    });
  });
}

export async function main(input: RunGateInput): Promise<RunGateOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('gates', runId);

  let payload: AdapterPayload;
  if (!GATE_ID_PATTERN.test(input.gateId)) {
    payload = { status: 'ERROR', violations: [], message: `invalid gateId: ${input.gateId}` };
  } else {
    payload = await runAdapter(input.gateId);
  }

  const reportPath = path.join(dir, 'report.json');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf-8');

  const result: RunGateOutput = {
    ...payload,
    runId,
    gateId: input.gateId,
    reportPath,
    artifactsPath: dir,
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('gates', runId, result);
  return result;
}

export default main;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/cic-run-gate && npx jest`
Expected: PASS, 3 tests. (First test's actual `status` value depends on live
GATE-01 mechanics — the test only asserts shape, not a specific status, so it
passes regardless of whether GATE-01 currently reports PASS or FAIL.)

- [ ] **Step 5: Add skill.json**

`skills/cic-run-gate/skill.json`:
```json
{
  "id": "cic-run-gate",
  "name": "CIC Run Gate",
  "version": "1.0.0",
  "description": "Run a CIC governance gate (GATE-01 only in Phase 1) and return a structured pass/fail result",
  "category": "governance",
  "triggers": ["cic-run-gate", "run gate", "gate-01"],
  "role": "ops",
  "runtime": "node",
  "entrypoint": "src/index.ts",
  "integrations": {
    "cowork": {
      "registered": false,
      "pluginType": "skill",
      "icon": "shield-check",
      "registrationPath": "cowork://toolforge/skills/cic-run-gate",
      "status": "pending_registration"
    }
  },
  "tooltip": "Run CIC GATE-01 and return structured result"
}
```

`skills/cic-run-gate/docs/USAGE.md`:
```markdown
# cic-run-gate

Phase 1: only `gateId: "GATE-01"` is wired to real mechanics (via
`CIC-GOVERNANCE/adapters/run_gate_adapter.py`, driving
`Gate01TransactionTests` from `CIC-GOVERNANCE/tests/test_gate_runtime.py`).
Any other gateId returns `status: "ERROR", message: "gate not wired"`.
Malformed gateId (doesn't match `^GATE-\d{2}$`) is rejected before any
subprocess is spawned.

`scope` and `profile` inputs are accepted but not yet consumed — GATE-01's
current mechanics take no such parameters. Known Phase 1 gap, not silent
data loss.

Paths (`artifactsPath`, `reportPath`) are relative to repo root
(`<repo-root>/cic/artifacts/gates/<runId>/...`), matching the Windows-path
deviation documented in `_cic-shared`'s task and
`C:\dev\docs\meta\cic-tool-surface-phase1-design.md`.

## Input
`{ gateId: string; scope?: string; profile?: string }`

## Output
`{ runId, gateId, status, violations[], reportPath, artifactsPath, message, timestamp }`
```

- [ ] **Step 6: Register in root manifest.json**
```json
{
  "version": "1.0.0",
  "description": "Run a CIC governance gate (GATE-01 only in Phase 1) and return a structured pass/fail result",
  "timestamps": { "created": "<ISO8601 now>", "lastValidation": null, "lastRun": null },
  "tags": ["cic", "governance", "phase1", "gate"],
  "status": "active",
  "name": "cic-run-gate",
  "runtime": "node",
  "id": "cic-run-gate",
  "entrypoint": "src/index.ts",
  "owner": "soren",
  "category": "governance",
  "health": { "canonical": true, "runtime": "untested", "distributed": false, "overall": "good" },
  "dependencies": { "external": ["python3.12"], "internal": ["_cic-shared"] }
}
```

- [ ] **Step 7: Commit**
```bash
git add skills/cic-run-gate manifest.json
git commit -m "feat(cic-tool-surface): add cic-run-gate skill wrapping GATE-01 adapter"
```

---

### Task 7: Full-suite validation

**Files:** none created — verification only.

- [ ] **Step 1: Run every skill's test suite**

```bash
cd skills/_cic-shared && npx jest && cd ../..
cd skills/cic-ingest-world && npx jest && cd ../..
cd skills/cic-repair-pipeline && npx jest && cd ../..
cd skills/cic-consolidate-artifacts && npx jest && cd ../..
cd skills/cic-run-gate && npx jest && cd ../..
```
Expected: all PASS.

- [ ] **Step 2: Run Python adapter tests**

```bash
cd CIC-GOVERNANCE && python -m pytest adapters/tests/test_run_gate_adapter.py -v && cd ..
```
Expected: PASS.

- [ ] **Step 3: Run the repo's toolforge skill validator**

```bash
powershell -File utilities/toolforgeSkillValidator.ps1
```
Expected: no new errors introduced by the 5 new skills (pre-existing
"Invalid category" warnings on unrelated skills are known noise — do not
attempt to fix those as part of this plan).

- [ ] **Step 4: Confirm `manifest.json` is valid JSON with 5 new entries**

```bash
node -e "const m = require('./manifest.json'); const ids = m.skills.map(s => s.id); ['_cic-shared','cic-ingest-world','cic-repair-pipeline','cic-consolidate-artifacts','cic-run-gate'].forEach(id => { if (id !== '_cic-shared' && !ids.includes(id)) throw new Error('missing ' + id); }); console.log('ok');"
```
Note: `_cic-shared` is an internal module, not a registered skill — it should
NOT appear in `manifest.json`'s `skills` array. Confirm it does not.

- [ ] **Step 5: Final commit (if Step 3/4 required any fixes)**

```bash
git add -A
git commit -m "chore(cic-tool-surface): Phase 1 validation pass"
```

If Steps 1-4 all passed with no fixes needed, skip this commit — nothing to add.

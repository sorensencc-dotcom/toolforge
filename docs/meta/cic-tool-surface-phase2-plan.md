# CIC Tool Surface Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `_cic-shared` with repo-root-anchored path resolution and
`lineage/`/`reports/` index helpers, then retrofit `cic-run-gate` and
`cic-ingest-world` to write into those new index dirs.

**Architecture:** `findRepoRoot` walks up from a start dir to the nearest
`.git` ancestor (bounded, memoized). `artifactPaths` gains an optional
`repoRoot` param defaulting to this resolution instead of `process.cwd()`.
Two new path-builder/writer pairs (`lineagePaths`/`writeLineageEntry`,
`reportPaths`/`writeReportEntry`) mirror the existing `artifactPaths`/
`writeResultJson` shape exactly. `cic-run-gate` and `cic-ingest-world` each
gain one additional write call after their existing logic; `cic-repair-pipeline`
and `cic-consolidate-artifacts` are untouched.

**Tech Stack:** Node/TypeScript (jest, ts-jest — same as Phase 1). No new
dependencies.

## Global Constraints

- Spec of record: `C:\dev\docs\meta\cic-tool-surface-phase2-design.md`. If
  any task here conflicts with it, the spec wins — flag the conflict instead
  of silently picking one.
- `findRepoRoot` bound: 20 levels or filesystem root, whichever comes first.
  Throws if no `.git` found within that bound. Memoized per-process, keyed
  by `startDir`.
- `lineage/<kind>/<id>.json` and `reports/<kind>/<id>.json` are single files
  directly under a per-kind dir — no per-id subdirectory (unlike
  `artifacts/<kind>/<id>/result.json`).
- Only `cic-run-gate` (reports) and `cic-ingest-world` (lineage) write index
  entries in Phase 2. `cic-repair-pipeline` and `cic-consolidate-artifacts`
  are not modified.
- No new external npm dependencies. No new skill.json/manifest.json entries
  — this phase only modifies existing `_cic-shared`, `cic-run-gate`, and
  `cic-ingest-world` internals.

---

## File Structure

```
skills/_cic-shared/src/
  findRepoRoot.ts        — new: findRepoRoot(startDir) -> string
  artifactPaths.ts        — modified: add optional repoRoot param
  lineagePaths.ts          — new: lineagePaths(kind, id, repoRoot?) -> { dir, file }
  reportPaths.ts            — new: reportPaths(kind, id, repoRoot?) -> { dir, file }
  writeLineageEntry.ts       — new: writeLineageEntry(kind, id, payload) -> Promise<string>
  writeReportEntry.ts         — new: writeReportEntry(kind, id, payload) -> Promise<string>
skills/_cic-shared/tests/shared.test.ts   — modified: add/replace tests for the above

skills/cic-run-gate/src/index.ts          — modified: write report index entry
skills/cic-run-gate/tests/skill.test.ts   — modified: assert report index entry written

skills/cic-ingest-world/src/index.ts          — modified: write lineage index entry
skills/cic-ingest-world/tests/skill.test.ts   — modified: assert lineage index entry written
```

Task 1 (`findRepoRoot` + `artifactPaths` fix) is built first — Task 2's
helpers import `findRepoRoot` too. Tasks 3 and 4 depend on Task 2's writer
functions and can be done in either order.

---

### Task 1: `findRepoRoot` + repo-root-anchored `artifactPaths`

**Files:**
- Create: `skills/_cic-shared/src/findRepoRoot.ts`
- Modify: `skills/_cic-shared/src/artifactPaths.ts`
- Modify: `skills/_cic-shared/tests/shared.test.ts`

**Interfaces:**
- Produces:
  - `findRepoRoot(startDir: string): string` — throws `Error` if no `.git`
    ancestor found within 20 levels or the filesystem root.
  - `artifactPaths(kind: string, id: string, repoRoot?: string): { dir: string; resultFile: string }`
    — unchanged return shape; `repoRoot` now defaults to
    `findRepoRoot(__dirname)` instead of using `process.cwd()`.

- [ ] **Step 1: Write failing tests**

Replace the `artifactPaths` describe block and add `findRepoRoot` tests in
`skills/_cic-shared/tests/shared.test.ts`. Full new file content:

```ts
import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateRunId, generateBundleId } from '../src/runId';
import { artifactPaths } from '../src/artifactPaths';
import { writeResultJson } from '../src/writeResultJson';
import { findRepoRoot } from '../src/findRepoRoot';

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

describe('findRepoRoot', () => {
  it('finds the .git ancestor from a nested dir', () => {
    const root = findRepoRoot(__dirname);
    expect(fs.existsSync(path.join(root, '.git'))).toBe(true);
  });

  it('throws when no .git is found within the bound', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cic-norepo-'));
    try {
      expect(() => findRepoRoot(tmp)).toThrow(/no \.git found/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('artifactPaths', () => {
  it('builds dir and resultFile under <repoRoot>/cic/artifacts/<kind>/<id>', () => {
    const repoRoot = findRepoRoot(__dirname);
    const { dir, resultFile } = artifactPaths('gates', 'run-test-1');
    expect(dir).toBe(path.join(repoRoot, 'cic', 'artifacts', 'gates', 'run-test-1'));
    expect(resultFile).toBe(path.join(dir, 'result.json'));
  });

  it('resolves the same dir regardless of process.cwd()', () => {
    const before = artifactPaths('gates', 'run-repo-root-test');
    const originalCwd = process.cwd();
    process.chdir(path.parse(originalCwd).root);
    try {
      const after = artifactPaths('gates', 'run-repo-root-test');
      expect(after.dir).toBe(before.dir);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('accepts an explicit repoRoot override', () => {
    const { dir } = artifactPaths('gates', 'run-test-2', 'C:\\fake-root');
    expect(dir).toBe(path.join('C:\\fake-root', 'cic', 'artifacts', 'gates', 'run-test-2'));
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd skills/_cic-shared && npx jest`
Expected: FAIL — `Cannot find module '../src/findRepoRoot'`, plus the
`artifactPaths` describe block fails (still using `process.cwd()`).

- [ ] **Step 3: Implement `findRepoRoot`**

`skills/_cic-shared/src/findRepoRoot.ts`:
```ts
import * as fs from 'fs';
import * as path from 'path';

const MAX_LEVELS = 20;
const cache = new Map<string, string>();

export function findRepoRoot(startDir: string): string {
  const cached = cache.get(startDir);
  if (cached) return cached;

  let dir = path.resolve(startDir);
  for (let i = 0; i < MAX_LEVELS; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      cache.set(startDir, dir);
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`findRepoRoot: no .git found within ${MAX_LEVELS} levels of ${startDir}`);
}
```

- [ ] **Step 4: Update `artifactPaths` to use it**

`skills/_cic-shared/src/artifactPaths.ts` (full replacement):
```ts
import * as path from 'path';
import { findRepoRoot } from './findRepoRoot';

export interface ArtifactPaths {
  dir: string;
  resultFile: string;
}

export function artifactPaths(
  kind: string,
  id: string,
  repoRoot: string = findRepoRoot(__dirname)
): ArtifactPaths {
  const dir = path.join(repoRoot, 'cic', 'artifacts', kind, id);
  return { dir, resultFile: path.join(dir, 'result.json') };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd skills/_cic-shared && npx jest`
Expected: PASS, 9 tests (3 runId + 2 findRepoRoot + 3 artifactPaths + 1 writeResultJson).

- [ ] **Step 6: Commit**

```bash
git add skills/_cic-shared/src/findRepoRoot.ts skills/_cic-shared/src/artifactPaths.ts skills/_cic-shared/tests/shared.test.ts
git commit -m "fix(cic-tool-surface): anchor artifactPaths at repo root, not process.cwd()"
```

---

### Task 2: `lineagePaths`/`reportPaths` + `writeLineageEntry`/`writeReportEntry`

**Files:**
- Create: `skills/_cic-shared/src/lineagePaths.ts`
- Create: `skills/_cic-shared/src/reportPaths.ts`
- Create: `skills/_cic-shared/src/writeLineageEntry.ts`
- Create: `skills/_cic-shared/src/writeReportEntry.ts`
- Modify: `skills/_cic-shared/tests/shared.test.ts`

**Interfaces:**
- Consumes: `findRepoRoot` from `./findRepoRoot` (Task 1)
- Produces:
  - `lineagePaths(kind: string, id: string, repoRoot?: string): { dir: string; file: string }`
  - `reportPaths(kind: string, id: string, repoRoot?: string): { dir: string; file: string }`
  - `writeLineageEntry(kind: string, id: string, payload: Record<string, unknown>): Promise<string>`
  - `writeReportEntry(kind: string, id: string, payload: Record<string, unknown>): Promise<string>`

- [ ] **Step 1: Write failing tests**

Append to `skills/_cic-shared/tests/shared.test.ts`:
```ts
import { lineagePaths } from '../src/lineagePaths';
import { reportPaths } from '../src/reportPaths';
import { writeLineageEntry } from '../src/writeLineageEntry';
import { writeReportEntry } from '../src/writeReportEntry';

describe('lineagePaths / reportPaths', () => {
  it('builds a single json file per id under <repoRoot>/cic/lineage/<kind>', () => {
    const repoRoot = findRepoRoot(__dirname);
    const { dir, file } = lineagePaths('ingest', 'run-lineage-test');
    expect(dir).toBe(path.join(repoRoot, 'cic', 'lineage', 'ingest'));
    expect(file).toBe(path.join(dir, 'run-lineage-test.json'));
  });

  it('builds a single json file per id under <repoRoot>/cic/reports/<kind>', () => {
    const repoRoot = findRepoRoot(__dirname);
    const { dir, file } = reportPaths('gates', 'run-report-test');
    expect(dir).toBe(path.join(repoRoot, 'cic', 'reports', 'gates'));
    expect(file).toBe(path.join(dir, 'run-report-test.json'));
  });
});

describe('writeLineageEntry / writeReportEntry', () => {
  const kind = 'test-kind';
  const id = 'run-index-write-test';

  afterEach(() => {
    fs.rmSync(lineagePaths(kind, id).dir, { recursive: true, force: true });
    fs.rmSync(reportPaths(kind, id).dir, { recursive: true, force: true });
  });

  it('writeLineageEntry writes payload to file and returns its path', async () => {
    const payload = { runId: id, lineageRef: 'lineage:test:x', status: 'stub' };
    const written = await writeLineageEntry(kind, id, payload);
    expect(written).toBe(lineagePaths(kind, id).file);
    expect(JSON.parse(fs.readFileSync(written, 'utf-8'))).toEqual(payload);
  });

  it('writeReportEntry writes payload to file and returns its path', async () => {
    const payload = { runId: id, gateId: 'GATE-01', status: 'PASS' };
    const written = await writeReportEntry(kind, id, payload);
    expect(written).toBe(reportPaths(kind, id).file);
    expect(JSON.parse(fs.readFileSync(written, 'utf-8'))).toEqual(payload);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd skills/_cic-shared && npx jest`
Expected: FAIL — `Cannot find module '../src/lineagePaths'` (and siblings).

- [ ] **Step 3: Implement**

`skills/_cic-shared/src/lineagePaths.ts`:
```ts
import * as path from 'path';
import { findRepoRoot } from './findRepoRoot';

export interface IndexPaths {
  dir: string;
  file: string;
}

export function lineagePaths(
  kind: string,
  id: string,
  repoRoot: string = findRepoRoot(__dirname)
): IndexPaths {
  const dir = path.join(repoRoot, 'cic', 'lineage', kind);
  return { dir, file: path.join(dir, `${id}.json`) };
}
```

`skills/_cic-shared/src/reportPaths.ts`:
```ts
import * as path from 'path';
import { findRepoRoot } from './findRepoRoot';

export interface IndexPaths {
  dir: string;
  file: string;
}

export function reportPaths(
  kind: string,
  id: string,
  repoRoot: string = findRepoRoot(__dirname)
): IndexPaths {
  const dir = path.join(repoRoot, 'cic', 'reports', kind);
  return { dir, file: path.join(dir, `${id}.json`) };
}
```

`skills/_cic-shared/src/writeLineageEntry.ts`:
```ts
import * as fs from 'fs/promises';
import { lineagePaths } from './lineagePaths';

export async function writeLineageEntry(
  kind: string,
  id: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { dir, file } = lineagePaths(kind, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8');
  return file;
}
```

`skills/_cic-shared/src/writeReportEntry.ts`:
```ts
import * as fs from 'fs/promises';
import { reportPaths } from './reportPaths';

export async function writeReportEntry(
  kind: string,
  id: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { dir, file } = reportPaths(kind, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8');
  return file;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd skills/_cic-shared && npx jest`
Expected: PASS, 13 tests (9 from Task 1 + 2 lineagePaths/reportPaths + 2 writeLineageEntry/writeReportEntry).

- [ ] **Step 5: Commit**

```bash
git add skills/_cic-shared/src/lineagePaths.ts skills/_cic-shared/src/reportPaths.ts skills/_cic-shared/src/writeLineageEntry.ts skills/_cic-shared/src/writeReportEntry.ts skills/_cic-shared/tests/shared.test.ts
git commit -m "feat(cic-tool-surface): add lineage/report index path+writer helpers"
```

---

### Task 3: Retrofit `cic-run-gate` to write a report index entry

**Files:**
- Modify: `skills/cic-run-gate/src/index.ts`
- Modify: `skills/cic-run-gate/tests/skill.test.ts`

**Interfaces:**
- Consumes: `writeReportEntry`, `reportPaths` from `_cic-shared` (Task 2)
- Produces: no change to `RunGateOutput` shape — the report index write is
  a side effect alongside the existing `report.json`/`result.json` writes.

- [ ] **Step 1: Write failing test**

Append to `skills/cic-run-gate/tests/skill.test.ts`:
```ts
import * as fs from 'fs';
import { reportPaths } from '../../_cic-shared/src/reportPaths';

describe('cic-run-gate report index', () => {
  it('writes a report index entry under cic/reports/gates/<runId>.json', async () => {
    const result = await main({ gateId: 'GATE-01' });
    const { file } = reportPaths('gates', result.runId);
    expect(fs.existsSync(file)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(entry).toEqual({
      runId: result.runId,
      gateId: 'GATE-01',
      status: result.status,
      reportPath: result.reportPath,
      timestamp: result.timestamp,
    });
  }, 20000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/cic-run-gate && npx jest`
Expected: FAIL — index file does not exist (`expect(fs.existsSync(file)).toBe(true)` fails).

- [ ] **Step 3: Implement**

In `skills/cic-run-gate/src/index.ts`, add the import and the write call.
Full updated file:
```ts
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';
import { writeReportEntry } from '../../_cic-shared/src/writeReportEntry';

export interface RunGateInput { gateId: string; scope?: string; profile?: string; }
interface AdapterPayload { status: 'PASS' | 'FAIL' | 'ERROR'; violations: { testId: string; description: string; outcome: string }[]; message: string; }
export interface RunGateOutput extends AdapterPayload { runId: string; gateId: string; reportPath: string; artifactsPath: string; timestamp: string; }
const GATE_ID_PATTERN = /^GATE-\d{2}$/;
const ADAPTER_PATH = path.resolve(__dirname, '../../../CIC-GOVERNANCE/adapters/run_gate_adapter.py');
const ADAPTER_CWD = path.resolve(__dirname, '../../../CIC-GOVERNANCE');
const SPAWN_TIMEOUT_MS = 15000;

function runAdapter(gateId: string): Promise<AdapterPayload> {
  return new Promise((resolve) => {
    const child = spawn('python', [ADAPTER_PATH, gateId], { cwd: ADAPTER_CWD });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill(); resolve({ status: 'ERROR', violations: [], message: 'adapter timed out' }); }, SPAWN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => { clearTimeout(timer); if (code !== 0) { resolve({ status: 'ERROR', violations: [], message: `adapter exited ${code}: ${stderr.trim()}` }); return; } try { const line = stdout.trim().split('\n').filter(Boolean)[0] ?? ''; resolve(JSON.parse(line)); } catch { resolve({ status: 'ERROR', violations: [], message: 'adapter produced invalid JSON' }); } });
    child.on('error', (err) => { clearTimeout(timer); resolve({ status: 'ERROR', violations: [], message: `failed to spawn adapter: ${err.message}` }); });
  });
}

export async function main(input: RunGateInput): Promise<RunGateOutput> {
  const runId = generateRunId(); const { dir } = artifactPaths('gates', runId);
  let payload: AdapterPayload;
  if (!GATE_ID_PATTERN.test(input.gateId)) payload = { status: 'ERROR', violations: [], message: `invalid gateId: ${input.gateId}` };
  else payload = await runAdapter(input.gateId);
  const reportPath = path.join(dir, 'report.json'); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf-8');
  const timestamp = new Date().toISOString();
  const result: RunGateOutput = { ...payload, runId, gateId: input.gateId, reportPath, artifactsPath: dir, timestamp };
  await writeResultJson('gates', runId, result as unknown as Record<string, unknown>);
  await writeReportEntry('gates', runId, { runId, gateId: input.gateId, status: payload.status, reportPath, timestamp });
  return result;
}
export default main;
```

Note: `timestamp` is now computed once and reused in both the `result` object
and the report index entry, instead of being inlined twice (which would
produce two slightly different ISO timestamps).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/cic-run-gate && npx jest`
Expected: PASS, 4 tests (3 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add skills/cic-run-gate/src/index.ts skills/cic-run-gate/tests/skill.test.ts
git commit -m "feat(cic-tool-surface): cic-run-gate writes report index entry"
```

---

### Task 4: Retrofit `cic-ingest-world` to write a lineage index entry

**Files:**
- Modify: `skills/cic-ingest-world/src/index.ts`
- Modify: `skills/cic-ingest-world/tests/skill.test.ts`

**Interfaces:**
- Consumes: `writeLineageEntry`, `lineagePaths` from `_cic-shared` (Task 2)
- Produces: no change to `IngestOutput` shape — `lineageRef` field is
  unchanged; the lineage index write is an additional side effect.

- [ ] **Step 1: Write failing test**

Append to `skills/cic-ingest-world/tests/skill.test.ts`:
```ts
import * as fs from 'fs';
import { lineagePaths } from '../../_cic-shared/src/lineagePaths';

describe('cic-ingest-world lineage index', () => {
  it('writes a lineage index entry under cic/lineage/ingest/<runId>.json', async () => {
    const result = await main({ sourceId: 'demo-source' });
    const { file } = lineagePaths('ingest', result.runId);
    expect(fs.existsSync(file)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(entry).toEqual({
      runId: result.runId,
      lineageRef: result.lineageRef,
      sourceId: 'demo-source',
      status: 'stub',
      timestamp: result.timestamp,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/cic-ingest-world && npx jest`
Expected: FAIL — index file does not exist.

- [ ] **Step 3: Implement**

Full updated `skills/cic-ingest-world/src/index.ts`:
```ts
import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';
import { writeLineageEntry } from '../../_cic-shared/src/writeLineageEntry';

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
  const timestamp = new Date().toISOString();
  const lineageRef = `lineage:ingest:${input.sourceId}:${runId}`;
  const result: IngestOutput = {
    runId,
    status: 'stub',
    artifactsPath: dir,
    lineageRef,
    timestamp,
  };
  await writeResultJson('ingest', runId, result as unknown as Record<string, unknown>);
  await writeLineageEntry('ingest', runId, {
    runId, lineageRef, sourceId: input.sourceId, status: 'stub', timestamp,
  });
  return result;
}

export default main;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/cic-ingest-world && npx jest`
Expected: PASS, 3 tests (2 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add skills/cic-ingest-world/src/index.ts skills/cic-ingest-world/tests/skill.test.ts
git commit -m "feat(cic-tool-surface): cic-ingest-world writes lineage index entry"
```

---

### Task 5: Full-suite validation

**Files:** none created — verification only.

- [ ] **Step 1: Run every modified skill's test suite**

```bash
cd skills/_cic-shared && npx jest && cd ../..
cd skills/cic-run-gate && npx jest && cd ../..
cd skills/cic-ingest-world && npx jest && cd ../..
```
Expected: all PASS (13 / 4 / 3 tests respectively, per Tasks 1-4).

- [ ] **Step 2: Run untouched skills' suites to confirm no regression**

```bash
cd skills/cic-repair-pipeline && npx jest && cd ../..
cd skills/cic-consolidate-artifacts && npx jest && cd ../..
```
Expected: PASS, unchanged from Phase 1 (1 test each) — these skills were not
modified, this just confirms Task 1's `artifactPaths` signature change
(adding an optional 3rd param) didn't break their existing calls.

- [ ] **Step 3: Add top-level `/cic/` to `.gitignore`**

Phase 1's `.gitignore` (commit `f1df94c`) only excludes `skills/*/cic/` —
the old `process.cwd()`-relative location. Task 1 of this plan moves every
write to `<repoRoot>/cic/...` (repo root, not per-skill), which that
pattern does not match. Add the missing rule:

`.gitignore` — insert after line 13 (`skills/*/cic/`):
```
/cic/
```

- [ ] **Step 4: Verify the new dirs are gitignored**

```bash
git add .gitignore
git status --short cic/lineage/ingest/ cic/reports/gates/ 2>/dev/null
git check-ignore -v cic/lineage/ingest/test.json cic/reports/gates/test.json
```
Expected: `git check-ignore -v` prints a matching rule (`.gitignore:14:/cic/`)
for both paths.

- [ ] **Step 4: Run the repo's toolforge skill validator**

```bash
powershell -File utilities/toolforgeSkillValidator.ps1
```
Expected: no new errors introduced. Pre-existing "Missing SKILL.md/README.md/
INTEGRATION_DIAGRAM.md" and "Invalid category" warnings on `_cic-shared` and
the 4 `cic-*` skills are known Phase 1 noise (skills are
`pending_registration`) — do not attempt to fix those as part of this plan.

- [ ] **Step 5: Final commit (if Step 3 or Step 4 required any fixes)**

```bash
git add -A
git commit -m "chore(cic-tool-surface): Phase 2 validation pass"
```

If Steps 1-4 all passed with no fixes needed, skip this commit — nothing to add.

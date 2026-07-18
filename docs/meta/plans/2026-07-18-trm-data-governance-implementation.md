# TRM Data Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tool-enforced guardrail (`assertSafeRoot`) that refuses to run the `trm` CLI against a root inside a git repo with a remote, then migrate the existing live TRM data out of the public `charlie-deep-research` repo into a dedicated local-only vault.

**Architecture:** One new pure function (`assertSafeRoot`) walks up from a given root looking for `.git`, parses `.git/config` for a `[remote "..."]` section, and throws if one exists (override via `TRM_ALLOW_GIT_ROOT=1`). It's called once in `trm/src/cli/index.ts`, so every CLI command inherits the check without touching the underlying `run*` functions or their existing tmpdir-based unit tests. Data migration is a manual filesystem move done via Bash after the guardrail is verified working, followed by a live smoke test proving the guardrail actually blocks the old public-repo location and passes on the new vault.

**Tech Stack:** TypeScript, Node `node:fs`/`node:path`, existing trm test runner (per `package.json` — Vitest, matching all other `tests/**/*.test.ts` in this repo).

## Global Constraints

- Vault location: `C:\Users\soren\trm-vault` (spec §2).
- No remote ever configured in the vault's own git repo by default (spec §3).
- `assertSafeRoot` throws only when `.git` is found **with** a configured remote; no `.git` found, or `.git` found with no remote, both pass silently (spec §5).
- Override env var is exactly `TRM_ALLOW_GIT_ROOT=1` (spec §5).
- Called exactly once, in `trm/src/cli/index.ts`, immediately after `const root = process.cwd();` and before `program.parse()` (spec §5).
- Migration moves `charlie-deep-research/trm-data`'s full contents (`charlie/cuba`, 7 sources, 85 facts) into `trm-vault/topics/charlie/cuba`, then the untracked copy in `charlie-deep-research` is deleted entirely (spec §6).

---

### Task 1: `assertSafeRoot` core function

**Files:**
- Create: `C:\dev\trm\src\core\rootSafety.ts`
- Test: `C:\dev\trm\tests\core\rootSafety.test.ts`

**Interfaces:**
- Produces: `assertSafeRoot(root: string): void` — throws `Error` if `root` (or any ancestor directory) contains a `.git` directory whose `config` file has a `[remote "...."]` section, unless `process.env.TRM_ALLOW_GIT_ROOT === '1'`. Returns silently otherwise (no `.git` found at all, or `.git` found with no remote section).

- [ ] **Step 1: Write the failing tests**

```typescript
// C:\dev\trm\tests\core\rootSafety.test.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertSafeRoot } from '../../src/core/rootSafety';

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trm-rootsafety-'));
}

function initGitRepo(dir: string, withRemote: boolean): void {
  const gitDir = path.join(dir, '.git');
  fs.mkdirSync(gitDir, { recursive: true });
  const config = withRemote
    ? '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = https://github.com/example/example.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n'
    : '[core]\n\trepositoryformatversion = 0\n';
  fs.writeFileSync(path.join(gitDir, 'config'), config, 'utf-8');
}

describe('assertSafeRoot', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkTmpDir();
    delete process.env.TRM_ALLOW_GIT_ROOT;
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.TRM_ALLOW_GIT_ROOT;
  });

  it('passes silently when no .git is found anywhere above root', () => {
    const dataDir = path.join(tmpRoot, 'no-git-here');
    fs.mkdirSync(dataDir, { recursive: true });
    expect(() => assertSafeRoot(dataDir)).not.toThrow();
  });

  it('passes silently when .git exists at root with no remote configured', () => {
    initGitRepo(tmpRoot, false);
    expect(() => assertSafeRoot(tmpRoot)).not.toThrow();
  });

  it('passes silently when .git with no remote is found in an ancestor directory', () => {
    initGitRepo(tmpRoot, false);
    const nested = path.join(tmpRoot, 'topics', 'charlie', 'cuba');
    fs.mkdirSync(nested, { recursive: true });
    expect(() => assertSafeRoot(nested)).not.toThrow();
  });

  it('throws when .git at root has a remote configured', () => {
    initGitRepo(tmpRoot, true);
    expect(() => assertSafeRoot(tmpRoot)).toThrow(/remote/i);
  });

  it('throws when .git with a remote is found in an ancestor directory', () => {
    initGitRepo(tmpRoot, true);
    const nested = path.join(tmpRoot, 'trm-data', 'topics', 'charlie', 'cuba');
    fs.mkdirSync(nested, { recursive: true });
    expect(() => assertSafeRoot(nested)).toThrow(/remote/i);
  });

  it('does not throw when a remote is configured but TRM_ALLOW_GIT_ROOT=1 is set', () => {
    initGitRepo(tmpRoot, true);
    process.env.TRM_ALLOW_GIT_ROOT = '1';
    expect(() => assertSafeRoot(tmpRoot)).not.toThrow();
  });

  it('error message names the offending path and the override env var', () => {
    initGitRepo(tmpRoot, true);
    try {
      assertSafeRoot(tmpRoot);
      throw new Error('expected assertSafeRoot to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain(tmpRoot);
      expect(message).toContain('TRM_ALLOW_GIT_ROOT');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\dev\trm && npx vitest run tests/core/rootSafety.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/rootSafety'`

- [ ] **Step 3: Write the implementation**

```typescript
// C:\dev\trm\src\core\rootSafety.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

function hasConfiguredRemote(gitConfigPath: string): boolean {
  if (!fs.existsSync(gitConfigPath)) return false;
  const content = fs.readFileSync(gitConfigPath, 'utf-8');
  return /\[remote\s+"[^"]+"\]/.test(content);
}

function findEnclosingGitDir(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, '.git');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function assertSafeRoot(root: string): void {
  if (process.env.TRM_ALLOW_GIT_ROOT === '1') return;

  const gitDir = findEnclosingGitDir(root);
  if (!gitDir) return;

  const configPath = path.join(gitDir, 'config');
  if (!hasConfiguredRemote(configPath)) return;

  const repoDir = path.dirname(gitDir);
  throw new Error(
    `trm refuses to run: "${root}" is inside a git repository at "${repoDir}" ` +
      `that has a remote configured. TRM data must never risk being committed/pushed ` +
      `to a remote. Move the data outside this repo, or set TRM_ALLOW_GIT_ROOT=1 to override.`
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\dev\trm && npx vitest run tests/core/rootSafety.test.ts`
Expected: PASS, 7/7

- [ ] **Step 5: Commit**

```bash
cd C:\dev\trm
git add src/core/rootSafety.ts tests/core/rootSafety.test.ts
git commit -m "feat: add assertSafeRoot guardrail against public-remote git roots"
```

---

### Task 2: Wire `assertSafeRoot` into the CLI entrypoint

**Files:**
- Modify: `C:\dev\trm\src\cli\index.ts:1-11` (add import, add call after `const root = process.cwd();`)

**Interfaces:**
- Consumes: `assertSafeRoot(root: string): void` from Task 1 (`../core/rootSafety`).

- [ ] **Step 1: Modify `index.ts`**

Change the top of the file from:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runCreate } from './commands/create';
import { runIngest } from './commands/ingest';
import { runExtract } from './commands/extract';
import { runScore } from './commands/score';
import { runCrosslink } from './commands/crosslink';
import { runVersionBump } from './commands/versionBump';
import { runValidate } from './commands/validate';

const root = process.cwd();
const program = new Command();
```

to:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runCreate } from './commands/create';
import { runIngest } from './commands/ingest';
import { runExtract } from './commands/extract';
import { runScore } from './commands/score';
import { runCrosslink } from './commands/crosslink';
import { runVersionBump } from './commands/versionBump';
import { runValidate } from './commands/validate';
import { assertSafeRoot } from '../core/rootSafety';

const root = process.cwd();
assertSafeRoot(root);
const program = new Command();
```

- [ ] **Step 2: Full test suite still passes (no existing test exercises `index.ts` directly — confirms no regression)**

Run: `cd C:\dev\trm && npx vitest run`
Expected: PASS, same count as before Task 1 plus the 7 new tests, 0 failures

- [ ] **Step 3: Build/typecheck**

Run: `cd C:\dev\trm && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Live smoke test — guardrail blocks the actual public repo**

Run:
```bash
cd C:\dev\charlie-deep-research\trm-data
node C:\dev\trm\dist\cli\index.js validate charlie/cuba
```
(If `dist/` is stale, run `cd C:\dev\trm && npx tsc` first to rebuild.)

Expected: command exits non-zero, stderr contains `trm refuses to run` and names `charlie-deep-research` and `TRM_ALLOW_GIT_ROOT`. This is the concrete proof the guardrail would have caught the original near-miss.

- [ ] **Step 5: Commit**

```bash
cd C:\dev\trm
git add src/cli/index.ts
git commit -m "feat: enforce assertSafeRoot in trm CLI entrypoint"
```

---

### Task 3: Create the vault and verify the guardrail passes there

**Files:**
- None (filesystem operations only, run via Bash)

- [ ] **Step 1: Create the vault directory and init local-only git**

```bash
mkdir -p /c/Users/soren/trm-vault/topics
cd /c/Users/soren/trm-vault
git init
git config user.name "$(git -C /c/dev config user.name)"
git config user.email "$(git -C /c/dev config user.email)"
```

Do NOT run `git remote add` — the spec (§3) requires no remote by default.

- [ ] **Step 2: Copy the standard TRM config into the vault**

```bash
cp /c/dev/charlie-deep-research/trm-data/config.json /c/Users/soren/trm-vault/config.json
```

If `charlie-deep-research/trm-data/config.json` does not exist (config lives elsewhere in that tree), locate it first with:
```bash
find /c/dev/charlie-deep-research/trm-data -maxdepth 1 -name 'config.json'
```
and adjust the copy source accordingly — it must end up at `C:\Users\soren\trm-vault\config.json`.

- [ ] **Step 3: Live smoke test — guardrail passes on the new vault**

```bash
cd /c/Users/soren/trm-vault
node /c/dev/trm/dist/cli/index.js validate charlie/cuba
```

Expected at this point: FAILS, but with a *different* error — `charlie/cuba` doesn't exist yet under `trm-vault/topics/` (migration is Task 4). The important check here is that the failure is NOT the `assertSafeRoot` "refuses to run" error — confirming the guardrail itself passes silently in the vault before data exists.

- [ ] **Step 4: Commit the vault's own git history (local only)**

```bash
cd /c/Users/soren/trm-vault
git add config.json
git commit -m "chore: initialize trm-vault"
```

No push — there is no remote.

---

### Task 4: Migrate existing TRM data and delete the untracked copy

**Files:**
- None (filesystem operations only, run via Bash)

- [ ] **Step 1: Confirm current data location and content counts (baseline before moving)**

```bash
find /c/dev/charlie-deep-research/trm-data/topics/charlie/cuba/sources/raw -name 'SRC-*.txt' | wc -l
```
Expected: `7`

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('/c/dev/charlie-deep-research/trm-data/topics/charlie/cuba/extracts/extract.json','utf-8')).facts.length)"
```
Expected: `85`

- [ ] **Step 2: Move the topic node into the vault**

```bash
mkdir -p /c/Users/soren/trm-vault/topics/charlie
cp -r /c/dev/charlie-deep-research/trm-data/topics/charlie/cuba /c/Users/soren/trm-vault/topics/charlie/cuba
```

- [ ] **Step 3: Verify the copy is intact before deleting the source**

```bash
find /c/Users/soren/trm-vault/topics/charlie/cuba/sources/raw -name 'SRC-*.txt' | wc -l
```
Expected: `7`

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('/c/Users/soren/trm-vault/topics/charlie/cuba/extracts/extract.json','utf-8')).facts.length)"
```
Expected: `85`

```bash
diff -rq /c/dev/charlie-deep-research/trm-data/topics/charlie/cuba /c/Users/soren/trm-vault/topics/charlie/cuba
```
Expected: no output (directories identical)

- [ ] **Step 4: Live smoke test — validate command works against the migrated data in the vault**

```bash
cd /c/Users/soren/trm-vault
node /c/dev/trm/dist/cli/index.js validate charlie/cuba
```
Expected: exits 0, JSON output `"valid": true`, `"errors": []` for `charlie/cuba` (matching the last known-good validation from the original location, recorded in the pre-compaction session).

- [ ] **Step 5: Only after Step 4 passes — delete the untracked copy from charlie-deep-research**

```bash
rm -rf /c/dev/charlie-deep-research/trm-data
```

- [ ] **Step 6: Confirm charlie-deep-research has no trace of trm-data left (staged or working tree)**

```bash
cd /c/dev/charlie-deep-research
git status --short
```
Expected: `trm-data` does not appear (it was never tracked, so this should show nothing related to it — confirms no git history references it either, since it was never committed per the plan's Task 6 assumption in the spec).

- [ ] **Step 7: Commit the migrated data inside the vault**

```bash
cd /c/Users/soren/trm-vault
git add topics/charlie/cuba
git commit -m "chore: migrate charlie/cuba TRM data from charlie-deep-research"
```

No push — there is no remote (spec §3).

---

## Self-Review Notes

- **Spec coverage:** §2 (vault location) → Task 3. §3 (versioning, no remote) → Task 3 Steps 1/4, Task 4 Step 7. §4 (promotion boundary) → no code change required, confirmed unchanged, no task needed. §5 (guardrail) → Tasks 1-2, live-verified in Task 2 Step 4 and Task 3 Step 3. §6 (migration) → Task 4. §7 (YAGNI exclusions) → no tasks, correctly excluded. §8 (discrepancy note) → confirmed by Task 1's tests using tmpdirs with no enclosing `.git`, matching the existing `run*` function test pattern already in this repo.
- **Placeholder scan:** none found.
- **Type consistency:** `assertSafeRoot(root: string): void` used identically in Task 1's implementation and Task 2's call site.

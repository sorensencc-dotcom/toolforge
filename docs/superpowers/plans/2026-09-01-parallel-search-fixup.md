# Parallel search fix-up (T1-T5) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 11 defects recorded against the shipped `skills/parallel-search/` code (PRs #15/#16 on `origin/main`) so it matches the locked spec, across five sequential pull requests (T1-T5).

**Architecture:** No architectural change. Same three-function fail-closed wrapper module (`parallel_search`, `parallel_extract`, `parallel_task`) plus the Charlie adapter. T1 corrects SDK call paths/types/validation to match the real `parallel-web@0.3.2` client. T2 adds a live smoke test. T3 refactors the three wrappers onto a shared `defineOperation` skeleton (no behavior change). T4 adds the deferred `parallel_task_result` wrapper. T5 wires the Charlie adapter's Task Run path.

**Tech Stack:** TypeScript (strict), `tsx --test` (node:test runner), `parallel-web@0.3.2`.

**Spec:** `docs/superpowers/specs/2026-08-31-parallel-search-integration-design.md` (v1.2) — read it alongside this plan; defect numbers and line-referenced contract details below are drawn from it verbatim.

## Global Constraints

- All work happens on `feat/parallel-search-*` branches from a checkout under `C:\dev\dev-sandbox`. `C:\dev` is read-only. One pull request per task (T1 through T5).
- `parallel-web` pinned to `^0.3.2` (installed version verified: `0.3.2`).
- No `any` in the public surface; `unknown` plus type guards only. `strict: true`.
- Error `message` strings stay module-level constants; never interpolate provider text, URLs, queries, keys, or run identifiers (the one exception is `run_id` as a structured field, not string interpolation).
- Every `error(...)` call site must use one of the four known `ErrorCode` constants (`API_KEY_MISSING`, `INVALID_INPUT`, `INVALID_API_RESPONSE`, `PARALLEL_API_ERROR`).
- Do not delegate this work to Codex unattended (spec: Rollout and process).
- Baseline verified before writing this plan: `npm test` in `skills/parallel-search/` currently reports **5** passing tests (only `src/index.test.ts` runs; `charlie-deep-research-adapter.test.ts`'s 3 tests never execute — this is defect 6). A manual `tsc --noEmit --strict` pass on `src/index.ts` currently **exits 0** with no errors, because the hand-rolled structural `Client` type silently accepts `client.search(...)`/`client.extract(...)` — this is why defect 1 is invisible to `tsc` today and must be fixed before it can be type-checked away.

---

## Task 1 (T1 — PR 1 of 5): Fix-up — SDK call paths, client typing, query cap, beta header, corrupted docs, test runner, adapter regression, stray file

Covers spec defects 1, 2, 3, 4, 5, 6, 8, 10. This is the whole T1 pull request; land it as one branch, multiple commits, one PR.

**Files:**
- Create: `skills/parallel-search/tsconfig.json`
- Modify: `skills/parallel-search/src/index.ts`
- Modify: `skills/parallel-search/src/index.test.ts`
- Modify: `skills/parallel-search/src/charlie-deep-research-adapter.ts`
- Modify: `skills/parallel-search/src/charlie-deep-research-adapter.test.ts`
- Modify: `skills/parallel-search/package.json`
- Modify: `skills/parallel-search/README.md`
- Modify: `skills/parallel-search/tests/README.md`
- Delete (if present in your working tree — it is untracked, not on any branch): `skills/parallel-search/{`

**Interfaces:**
- Produces (for T2-T5 to consume): `Client = Pick<Parallel, "beta" | "taskRun">` (replaces the old structural `Client` type — name unchanged, shape changed); `SearchInput = { objective?: string; search_queries?: string[]; mode?: 'one-shot' | 'agentic' | 'fast' }` (both fields now optional, `mode` added); `SearchOutput = Record<string, unknown>` (unchanged name, now requires `results: unknown[]` at the guard level); `ExtractOutput` guard now requires `results` and `errors` both arrays; `TaskOutput` unchanged (`{ run_id, interaction_id, status, is_active, processor }`); `RuntimeOptions.clientFactory?: (key: string) => Client` (same signature, new `Client` shape — every mock in every test file must return `{ beta: { search, extract }, taskRun: { create } }`, not the old flat `{ search, extract, taskRun }`).

### Step 1: Add `tsconfig.json` (defect 5 — do this first so later steps are checked by `tsc`)

- [ ] **Write the file:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

Save to `skills/parallel-search/tsconfig.json`.

- [ ] **Add the typecheck script.** In `skills/parallel-search/package.json`, add to `"scripts"`:

```json
"typecheck": "tsc -p tsconfig.json"
```

- [ ] **Run it against the current (unfixed) code to confirm the baseline is clean before your changes:**

Run (from `skills/parallel-search/`): `npm run typecheck`
Expected: exits 0, no errors (confirms the structural `Client` type is still hiding defect 1 — you're about to remove it).

- [ ] **Commit:**

```bash
git add skills/parallel-search/tsconfig.json skills/parallel-search/package.json
git commit -m "chore(parallel-search): add tsconfig and typecheck script"
```

### Step 2: Fix client typing and SDK call paths (defect 1 — the core fix)

- [ ] **Update the failing tests first.** In `skills/parallel-search/src/index.test.ts`, every `clientFactory` mock currently returns a flat shape. Rewrite the file to use the real nested shape (`beta.search`, `beta.extract`, `taskRun.create`):

```ts
import { strict as assert } from "node:assert";
import test from "node:test";
import { parallel_extract, parallel_search, parallel_task } from "./index.js";

test("fails closed without API key", async () => {
  const r = await parallel_search({ objective: "x" }, { apiKey: " " });
  assert.deepEqual(r, { ok: false, error: { code: "API_KEY_MISSING", message: "PARALLEL_API_KEY is required" } });
});

test("requires objective or search_queries", async () => {
  const r = await parallel_search({}, { apiKey: "k" });
  assert.equal(r.ok, false);
  assert.equal((r as { ok: false; error: { code: string } }).error.code, "INVALID_INPUT");
});

test("accepts search_queries-only input", async () => {
  const r = await parallel_search({ search_queries: ["a", "b"] }, {
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => ({ results: [], search_id: "s" }), extract: async () => ({ results: [], errors: [] }) }, taskRun: { create: async () => ({}) } }),
  });
  assert.equal(r.ok, true);
});

test("validates extract URL limit", async () => {
  const r = await parallel_extract({ urls: Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`) }, { apiKey: "k" });
  assert.equal(r.ok, false);
});

test("calls taskRun create and returns task status", async () => {
  const r = await parallel_task({ input: "research", processor: "base" }, {
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => ({}), extract: async () => ({}) }, taskRun: { create: async () => ({ run_id: "r", interaction_id: "i", status: "queued", is_active: true, processor: "base" }) } }),
  });
  assert.deepEqual(r, { ok: true, data: { run_id: "r", interaction_id: "i", status: "queued", is_active: true, processor: "base" } });
});

test("maps SDK failure without leaking details", async () => {
  const r = await parallel_search({ objective: "x" }, {
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => { throw new Error("secret"); }, extract: async () => ({}) }, taskRun: { create: async () => ({}) } }),
  });
  assert.deepEqual(r, { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } });
});
```

- [ ] **Run it to verify it fails** (the source still has the old `Client` shape and old validation):

Run: `npx tsx --test src/index.test.ts`
Expected: FAIL — `beta` is undefined on the mock consumer side, or the "requires objective or search_queries" test fails because the old code demands both fields with a 2-3 element array.

- [ ] **Fix `skills/parallel-search/src/index.ts`.** Replace the whole file:

```ts
import Parallel from "parallel-web";

export type ErrorCode = "API_KEY_MISSING" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "PARALLEL_API_ERROR";
export type ToolError = { ok: false; error: { code: ErrorCode; message: string } };
export type OperationResult<T> = { ok: true; data: T } | ToolError;
export type SearchInput = { objective?: string; search_queries?: string[]; mode?: "one-shot" | "agentic" | "fast" };
export type ExtractInput = { urls: string[]; objective?: string };
export type TaskInput = { input: string | Record<string, unknown>; processor: string };
export type SearchOutput = Record<string, unknown>;
export type ExtractOutput = Record<string, unknown>;
export type TaskOutput = { run_id: string; interaction_id: string; status: string; is_active: boolean; processor: string };
type Client = Pick<Parallel, "beta" | "taskRun">;
export type RuntimeOptions = { apiKey?: string; clientFactory?: (key: string) => Client };

const error = (code: ErrorCode, message: string): ToolError => ({ ok: false, error: { code, message } });
const keyFor = (options?: RuntimeOptions) => options?.apiKey?.trim() || process.env.PARALLEL_API_KEY?.trim();
function clientFor(options?: RuntimeOptions): Client | ToolError { const key = keyFor(options); if (!key) return error("API_KEY_MISSING", "PARALLEL_API_KEY is required"); return options?.clientFactory?.(key) ?? new Parallel({ apiKey: key }); }
function validText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validUrl(value: unknown): value is string { try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol); } catch { return false; } }
function responseObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isSearchOutput(value: unknown): value is SearchOutput { return responseObject(value) && Array.isArray(value.results); }
function isExtractOutput(value: unknown): value is ExtractOutput { return responseObject(value) && Array.isArray(value.results) && Array.isArray(value.errors); }
async function call<T>(options: RuntimeOptions | undefined, fn: (client: Client) => Promise<unknown>, check: (value: unknown) => value is T): Promise<OperationResult<T>> { const client = clientFor(options); if (!("beta" in client)) return client; try { const value = await fn(client); return check(value) ? { ok: true, data: value } : error("INVALID_API_RESPONSE", "Parallel returned an invalid response"); } catch { return error("PARALLEL_API_ERROR", "Parallel request failed"); } }

export const parallel_search = (input: SearchInput, options?: RuntimeOptions): Promise<OperationResult<SearchOutput>> => {
  const hasObjective = validText(input?.objective);
  const hasQueries = Array.isArray(input?.search_queries) && input.search_queries.length > 0 && input.search_queries.every(validText);
  if (!responseObject(input) || (!hasObjective && !hasQueries)) return Promise.resolve(error("INVALID_INPUT", "objective or search_queries is required"));
  return call(options, client => client.beta.search({ ...(hasObjective ? { objective: input.objective!.trim() } : {}), ...(hasQueries ? { search_queries: input.search_queries!.map(q => q.trim()) } : {}), mode: input.mode ?? "agentic" }), isSearchOutput);
};
export const parallel_extract = (input: ExtractInput, options?: RuntimeOptions): Promise<OperationResult<ExtractOutput>> => {
  if (!responseObject(input) || !Array.isArray(input.urls) || input.urls.length < 1 || input.urls.length > 20 || !input.urls.every(validUrl) || (input.objective !== undefined && !validText(input.objective))) return Promise.resolve(error("INVALID_INPUT", "1–20 valid http(s) urls are required"));
  return call(options, client => client.beta.extract({ urls: input.urls, ...(input.objective ? { objective: input.objective.trim() } : {}), betas: ["search-extract-2025-10-10"] }), isExtractOutput);
};
export const parallel_task = (input: TaskInput, options?: RuntimeOptions): Promise<OperationResult<TaskOutput>> => {
  if (!responseObject(input) || (!validText(input.input) && !responseObject(input.input)) || !validText(input.processor)) return Promise.resolve(error("INVALID_INPUT", "input and processor are required"));
  const isTaskOutput = (value: unknown): value is TaskOutput => responseObject(value) && validText(value.run_id) && validText(value.interaction_id) && validText(value.status) && typeof value.is_active === "boolean" && validText(value.processor);
  return call(options, client => client.taskRun.create({ input: input.input, processor: input.processor.trim() }), isTaskOutput);
};
```

Note: `betas` on `client.beta.extract(...)` params is defect 3, folded in here since it's the same call-site edit.

- [ ] **Run tests to verify they pass:**

Run: `npx tsx --test src/index.test.ts`
Expected: PASS, 6 tests.

- [ ] **Typecheck:**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Prove defect 1 now fails `tsc` (one-time verification, not a permanent file).** Create a scratch file `skills/parallel-search/src/_scratch.ts` containing `import Parallel from "parallel-web"; declare const c: Pick<Parallel, "beta" | "taskRun">; c.search;` — run `npx tsc --noEmit -p tsconfig.json` (with the scratch file present) and confirm it fails with a property-does-not-exist error. Then delete `_scratch.ts`. Do not commit it.

- [ ] **Commit:**

```bash
git add skills/parallel-search/src/index.ts skills/parallel-search/src/index.test.ts
git commit -m "fix(parallel-search): use client.beta.search/extract, real SDK typing"
```

### Step 3: Remove the invented `search_queries` cap (defect 2)

Already implemented as part of Step 2 (the old `length < 2 || length > 3` rule is gone; the new rule is "at least one of `objective` or `search_queries`", validated by the `hasObjective`/`hasQueries` test added above). Nothing further to do here — this step exists so the defect has an explicit checkbox.

- [ ] **Confirm:** re-read `parallel_search` in `src/index.ts` and confirm no length-2/length-3 check remains. Confirmed by Step 2's `npx tsx --test` pass.

### Step 4: Add the extract beta header (defect 3)

Already implemented as part of Step 2 (`betas: ["search-extract-2025-10-10"]` on the `client.beta.extract(...)` call). Add a unit test that asserts it's present:

- [ ] **Add test** to `skills/parallel-search/src/index.test.ts`:

```ts
test("extract call includes the search-extract beta header", async () => {
  let seenParams: Record<string, unknown> | undefined;
  const r = await parallel_extract({ urls: ["https://example.com/a"] }, {
    apiKey: "k",
    clientFactory: () => ({
      beta: {
        search: async () => ({}),
        extract: async (params: Record<string, unknown>) => { seenParams = params; return { results: [], errors: [] }; },
      },
      taskRun: { create: async () => ({}) },
    }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(seenParams?.betas, ["search-extract-2025-10-10"]);
});
```

- [ ] **Run:** `npx tsx --test src/index.test.ts` — expect PASS, 7 tests.
- [ ] **Commit:**

```bash
git add skills/parallel-search/src/index.test.ts
git commit -m "test(parallel-search): assert extract beta header on outgoing params"
```

### Step 5: Fix the adapter field regression (defect 8)

- [ ] **Write the failing regression test.** In `skills/parallel-search/src/charlie-deep-research-adapter.test.ts`, replace the "normalizes search records" test with a real-shaped fixture built from the `.d.ts` types (no `snippet`/`link` fields — only `excerpts`/`url`):

```ts
import { strict as assert } from "node:assert";
import test from "node:test";
import { charlieDeepResearchSearch } from "./charlie-deep-research-adapter.js";

test("Charlie adapter is disabled by default", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", { enabled: false, apiKey: "k" });
  assert.deepEqual(result, { ok: false, error: { code: "FEATURE_DISABLED" } });
});

test("Charlie adapter normalizes real-shaped SearchResult records (regression: defect 8)", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: {
        search: async () => ({ search_id: "s_x", results: [{ url: "https://a.test", title: "A", excerpts: ["ex one"] }] }),
        extract: async () => ({}),
      },
      taskRun: { create: async () => ({}) },
    }),
  });
  assert.deepEqual(result, { ok: true, data: [{ title: "A", url: "https://a.test", snippet: "ex one" }] });
});

test("Charlie adapter drops records missing title or a valid url", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    apiKey: "k",
    clientFactory: () => ({
      beta: {
        search: async () => ({ search_id: "s_x", results: [{ url: "not-a-url", title: "A" }, { url: "https://a.test" }] }),
        extract: async () => ({}),
      },
      taskRun: { create: async () => ({}) },
    }),
  });
  assert.deepEqual(result, { ok: true, data: [] });
});

test("Charlie adapter preserves fail-closed provider errors", async () => {
  const result = await charlieDeepResearchSearch("Willow Run", "The Industrial Architect", {
    enabled: true,
    apiKey: "k",
    clientFactory: () => ({ beta: { search: async () => { throw new Error("secret"); }, extract: async () => ({}) }, taskRun: { create: async () => ({}) } }),
  });
  assert.deepEqual(result, { ok: false, error: { code: "PARALLEL_API_ERROR" } });
});
```

- [ ] **Run it to verify it fails:**

Run: `npx tsx --test src/charlie-deep-research-adapter.test.ts`
Expected: FAIL on the regression test — `normalize()` currently reads `record.snippet` (undefined, falls back to `""`) and `record.url ?? record.link` (still works for `url` present, but the fixture's `excerpts` never gets read), so `snippet` comes back `""` instead of `"ex one"`.

- [ ] **Fix `skills/parallel-search/src/charlie-deep-research-adapter.ts`:**

```ts
import { parallel_search, type OperationResult, type RuntimeOptions, type SearchOutput } from "./index.js";

export type CharlieResearchRecord = { title: string; url: string; snippet: string };
export type AdapterErrorCode = "FEATURE_DISABLED" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "API_KEY_MISSING" | "PARALLEL_API_ERROR";
export type AdapterResult = { ok: true; data: CharlieResearchRecord[] } | { ok: false; error: { code: AdapterErrorCode } };
export type AdapterOptions = RuntimeOptions & { enabled?: boolean };

const isEnabled = (options?: AdapterOptions) => options?.enabled ?? ["1", "true", "yes"].includes(process.env.CHARLIE_PARALLEL_SEARCH_ENABLED?.trim().toLowerCase() ?? "");
const fail = (code: AdapterErrorCode): AdapterResult => ({ ok: false, error: { code } });

function normalize(value: SearchOutput): CharlieResearchRecord[] | undefined {
  if (!Array.isArray(value.results)) return undefined;
  return value.results.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const title = record.title;
    const url = record.url;
    if (typeof title !== "string" || typeof url !== "string" || !/^https?:\/\//.test(url)) return [];
    const excerpts = record.excerpts;
    const snippet = Array.isArray(excerpts) && typeof excerpts[0] === "string" ? excerpts[0] : "";
    return [{ title, url, snippet }];
  });
}

export async function charlieDeepResearchSearch(topic: string, persona: string, options?: AdapterOptions): Promise<AdapterResult> {
  if (!isEnabled(options)) return fail("FEATURE_DISABLED");
  if (typeof topic !== "string" || !topic.trim() || typeof persona !== "string" || !persona.trim()) return fail("INVALID_INPUT");
  const result: OperationResult<SearchOutput> = await parallel_search({ objective: `Research ${topic.trim()} from the perspective of ${persona.trim()}`, search_queries: [topic.trim(), `${topic.trim()} history`, `${topic.trim()} primary sources`], mode: "agentic" }, options);
  if (result.ok === false) return fail(result.error.code);
  const data = normalize(result.data);
  return data ? { ok: true, data } : fail("INVALID_API_RESPONSE");
}
```

- [ ] **Run tests to verify they pass:**

Run: `npx tsx --test src/charlie-deep-research-adapter.test.ts`
Expected: PASS, 4 tests.

- [ ] **Commit:**

```bash
git add skills/parallel-search/src/charlie-deep-research-adapter.ts skills/parallel-search/src/charlie-deep-research-adapter.test.ts
git commit -m "fix(parallel-search): adapter reads excerpts[0]/url, not snippet/link (regression)"
```

### Step 6: Fix `npm test` to run both suites (defect 6)

- [ ] **Update `skills/parallel-search/package.json`** `"scripts"` block:

```json
"scripts": {
  "test": "tsx --test 'src/**/*.test.ts'",
  "typecheck": "tsc -p tsconfig.json"
}
```

- [ ] **Run and verify both suites execute with the expected total:**

Run (from `skills/parallel-search/`): `npm test`
Expected: `tests 11` (7 from `index.test.ts` + 4 from `charlie-deep-research-adapter.test.ts`), `pass 11`, `fail 0`.

- [ ] **Add the count assertion.** Create `skills/parallel-search/scripts/assert-test-count.mjs`:

```js
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
```

- [ ] **Point `npm test` at the guarded runner:**

```json
"scripts": {
  "test": "node scripts/assert-test-count.mjs",
  "typecheck": "tsc -p tsconfig.json"
}
```

- [ ] **Run and verify:**

Run: `npm test`
Expected: exits 0, prints the full `tsx --test` output including `tests 11`.

- [ ] **Verify the guard actually guards** (temporarily comment out one `test(...)` block in `charlie-deep-research-adapter.test.ts`, run `npm test`, confirm non-zero exit and the "silently dropped" message, then uncomment and re-run to confirm PASS again). Do not commit the temporary comment-out.

- [ ] **Commit:**

```bash
git add skills/parallel-search/package.json skills/parallel-search/scripts/assert-test-count.mjs
git commit -m "fix(parallel-search): run all test files, assert count so a dropped suite fails the build"
```

### Step 7: Fix corrupted README files (defect 4)

- [ ] **Rewrite `skills/parallel-search/README.md`** replacing every literal `` `n`n `` with real blank lines, and stripping the stray `^M` (CRLF) artifacts:

```markdown
# Parallel Search

Fail-closed TypeScript wrappers for Parallel Search, Extract, and asynchronous Task Run creation.

## Purpose

Provide deterministic current-web operations without exposing provider credentials or raw provider failures.

## Usage

Set `PARALLEL_API_KEY`, then call exports from `src/index.ts`.

## Permissions

Requires outbound web access to Parallel and no filesystem write access.

See [docs/USAGE.md](docs/USAGE.md) for inputs, outputs, and error handling.

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Toolforge conventions.
```

- [ ] **Rewrite `skills/parallel-search/tests/README.md`:**

```markdown
# Focused tests

Executable tests live in `src/index.test.ts` and `src/charlie-deep-research-adapter.test.ts`, and run through the local `npm test` script.
```

- [ ] **Verify no corruption remains:**

Run: `grep -n '\\`n\\`n' skills/parallel-search/README.md skills/parallel-search/tests/README.md`
Expected: no matches.

- [ ] **Commit:**

```bash
git add skills/parallel-search/README.md skills/parallel-search/tests/README.md
git commit -m "docs(parallel-search): fix here-string corruption in README files"
```

### Step 8: Delete the stray file (defect 10)

- [ ] **Check for it and remove if present:**

Run: `ls -la skills/parallel-search/'{' 2>/dev/null && rm skills/parallel-search/'{'`

If it doesn't exist in this fresh checkout (it's untracked local junk, not on any branch — confirmed absent from `git ls-tree origin/main`), skip; there is nothing to commit for this step.

### Step 9: Final verification and PR

- [ ] **Full suite:**

Run (from `skills/parallel-search/`): `npm test && npm run typecheck`
Expected: both exit 0.

- [ ] **Push and open the PR:**

```bash
git push -u origin feat/parallel-search-fixup-1
gh pr create --base main --title "fix(parallel-search): SDK call paths, client typing, query cap, beta header, test runner, adapter regression" --body "Fixes defects 1-6, 8, 10 from docs/superpowers/specs/2026-08-31-parallel-search-integration-design.md. See spec for full defect descriptions."
```

---

## Task 2 (T2 — PR 2 of 5): Live smoke test + debug sink

Covers spec defect 7, plus the `onError`/`PARALLEL_DEBUG` debug sink from the "Internal structure" section (needed so the smoke test can report a real failure cause). Branch from `main` **after T1 merges** (this task depends on T1's `client.beta.*` call paths).

**Files:**
- Modify: `skills/parallel-search/src/index.ts` (add `onError` to `RuntimeOptions`, wire the `catch` block)
- Create: `skills/parallel-search/src/index.smoke.test.ts`
- Create: `skills/parallel-search/fixtures/search-result.json`, `skills/parallel-search/fixtures/task-run.json`

**Interfaces:**
- Consumes: `Client`, `RuntimeOptions`, `parallel_search`, `parallel_task` from Task 1's `src/index.ts`.
- Produces: `RuntimeOptions.onError?: (err: unknown) => void` — T4 and T5 read this when building `parallel_task_result`'s own error path.

**Deliverable and test list** (write these as `node:test` cases the same way Task 1's steps were written — TDD, one failing test at a time):

- `onError` callback: a unit test with a `clientFactory` that throws, passing `onError: (err) => { seen = err }`, asserts `seen` is the thrown error and the returned `OperationResult` is still the opaque `PARALLEL_API_ERROR` (no message/stack leak in the return value).
- `PARALLEL_DEBUG=1` env var: a unit test that sets `process.env.PARALLEL_DEBUG = "1"`, spies on `console.error`, triggers a thrown SDK error, asserts `console.error` was called with the raw error; unset the env var in a `finally`.
- `src/index.smoke.test.ts`: single file, `node:test`'s `{ skip: !process.env.PARALLEL_API_KEY }` on the `test()` calls (skip entirely when the key is absent — do not fail CI). Two cases: real `client.beta.search` call with `objective: "test"`, asserting the resolved `SearchResult` has `results` (array) and `search_id` (string); real `client.taskRun.create` call with `processor: "base"`, `input: "test"`, asserting the resolved `TaskRun` has `run_id`, `interaction_id`, `status`, `is_active`, `processor`. Run with `PARALLEL_DEBUG=1` set in the test file itself (`process.env.PARALLEL_DEBUG = "1"` at top) so a failure prints the real cause per the spec.
- After a manual live run (requires a real `PARALLEL_API_KEY` — ask the operator for one or run this step yourself if you have one in your environment), save the observed response shapes to `skills/parallel-search/fixtures/search-result.json` and `skills/parallel-search/fixtures/task-run.json` as committed fixtures so future mocked tests can be built from real shapes, not guesses.
- Update `scripts/assert-test-count.mjs`'s glob or add a separate `npm run test:smoke` script — the smoke file must NOT run under default `npm test` (spec: "not in default CI"). Exclude `*.smoke.test.ts` from the `src/**/*.test.ts` glob used by `npm test`; add `"test:smoke": "tsx --test src/index.smoke.test.ts"` as a separate script.

- [ ] Write failing unit tests for `onError` and `PARALLEL_DEBUG`, watch them fail, implement the debug sink in `src/index.ts`, watch them pass, commit.
- [ ] Write `src/index.smoke.test.ts` per the deliverable above, run it locally with a real key if available (skip verification is fine if you don't have one — the assertion under test is the `{ skip: ... }` guard itself, verify by running WITHOUT the env var set and confirming both cases report skipped, not failed), commit.
- [ ] Split `npm test` / `npm run test:smoke` in `package.json`, verify `npm test` still reports the same count as Task 1 (smoke file excluded), commit.
- [ ] Push, open PR: `gh pr create --base main --title "test(parallel-search): live smoke test + debug sink (defect 7)" --body "..."`.

---

## Task 3 (T3 — PR 3 of 5): Refactor onto `defineOperation` (no behavior change)

Branch from `main` after T2 merges.

**Files:**
- Modify: `skills/parallel-search/src/index.ts`

**Interfaces:**
- Consumes: the post-T1/T2 `src/index.ts` exports, unchanged signatures.
- Produces: an internal `defineOperation(validate, networkFn, responseGuard)` helper (not exported — implementation detail). `parallel_search`, `parallel_extract`, `parallel_task` keep their exact existing signatures and behavior; only their bodies change to `defineOperation(...)` calls.

**Deliverable:**

- [ ] Before touching source, run `npm test` and record the exact pass count (should be Task 1's 11, or 11 plus whatever Task 2 added to the non-smoke suite) — this is your regression baseline.
- [ ] Extract `function defineOperation<TInput, TOutput>(validate: (input: TInput) => ToolError | undefined, networkFn: (client: Client, input: TInput) => Promise<unknown>, responseGuard: (value: unknown) => value is TOutput): (input: TInput, options?: RuntimeOptions) => Promise<OperationResult<TOutput>>` in `src/index.ts`. Each validator returns `undefined` on success or a `ToolError` on failure (reuse the exact validation logic already written for each of the three operations — this is a mechanical extraction, not a rewrite of the rules).
- [ ] Rewrite `parallel_search`, `parallel_extract`, `parallel_task` as one-line `defineOperation(...)` calls each.
- [ ] Run `npm test` — expected: same pass count as the baseline, zero test file changes needed (behavior-identical refactor is the point).
- [ ] Run `npm run typecheck` — expected: exits 0.
- [ ] Commit: `git commit -m "refactor(parallel-search): extract defineOperation skeleton, no behavior change"`.
- [ ] Push, open PR: `gh pr create --base main --title "refactor(parallel-search): shared defineOperation skeleton" --body "No behavior change; all existing tests pass unmodified. Prep for parallel_task_result (T4)."`.

---

## Task 4 (T4 — PR 4 of 5): `parallel_task_result` wrapper

Branch from `main` after T3 merges. This is new functionality — full TDD, not a fix.

**Files:**
- Modify: `skills/parallel-search/src/index.ts`
- Modify: `skills/parallel-search/src/index.test.ts`

**Interfaces:**
- Consumes: `defineOperation` (T3), `Client`, `error`, `responseObject`, `validText` from `src/index.ts`.
- Produces: `export const parallel_task_result: (input: { run_id: string; wait?: boolean; timeout_seconds?: number }, options?: RuntimeOptions) => Promise<OperationResult<TaskOutput | { status: string; output: { type: 'text' | 'json'; content: string | Record<string, unknown>; basis: unknown[] } }>>` with `error.run_id?: string` added to `ToolError`'s error shape on the timeout path. `TASK_RESULT_TIMEOUT_DEFAULT = 300`, `TASK_RESULT_TIMEOUT_MAX = 600` as exported constants (T5 imports the default).

**Contract (from spec "parallel_task_result" and "Async task lifecycle" sections — implement exactly this):**

- Validation: `run_id` non-empty string; `timeout_seconds` if present must be a positive number `<= 600` (`INVALID_INPUT` otherwise).
- `wait !== true`: call `client.taskRun.retrieve(run_id)`, return the narrowed 5-field `TaskRun` subset (reuse the existing `isTaskOutput` guard).
- `wait === true`: call `client.taskRun.result(run_id, { timeout: timeout_seconds ?? 300 })`, return `{ status, output: { type, content, basis } }`. Response guard: `output.type` is `'text'` or `'json'`, `output.content` present, `output.basis` is an array.
- Terminal non-success (`status` in `failed`/`cancelled`/`action_required`) is `{ ok: true, data: {...} }`, NOT an error.
- `wait: true` timeout: `{ ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed", run_id } }` — the `run_id` must survive on the error object so the caller can re-poll. This requires distinguishing "the SDK's `result()` call threw because the timeout elapsed" from any other thrown error, so the `catch` block for this one operation needs its own handling (cannot reuse `defineOperation`'s generic catch verbatim) — check the thrown error's `.name` or `.status` for a timeout-shaped `APIConnectionTimeoutError` from the SDK (import `Parallel` error classes from `parallel-web` and use `instanceof`), and attach `run_id` only in that branch; other thrown errors still map to the plain `PARALLEL_API_ERROR` with no `run_id`.

**Test list (write each as a failing test first, per Task 1's TDD pattern):**

- `run_id` empty string → `INVALID_INPUT`.
- `timeout_seconds` of `700` (over the 600 max) → `INVALID_INPUT`.
- `wait: false` (or omitted): mock `taskRun.retrieve` returning a full `TaskRun`, assert the 5-field subset comes back.
- `wait: true`: mock `taskRun.result` returning `{ output: { type: 'text', content: 'x', basis: [] }, run: { status: 'completed', ... } }`, assert `{ status: 'completed', output: { type: 'text', content: 'x', basis: [] } }`.
- `status: 'failed'` from `retrieve` → `ok: true`, data present (not an error).
- `status: 'cancelled'` from `retrieve` → `ok: true`, data present.
- `wait: true` with a mock `taskRun.result` that throws an object shaped like `APIConnectionTimeoutError` → `{ ok: false, error: { code: 'PARALLEL_API_ERROR', message: 'Parallel request failed', run_id: '<the input run_id>' } }`.
- `wait: true` with a mock that throws a plain `Error` (non-timeout) → same error code, no `run_id` on the error object.
- Response guard: `retrieve` resolves with a body missing `run_id` → `INVALID_API_RESPONSE`.

**Steps:**

- [ ] Write all 9 tests above against the not-yet-existing `parallel_task_result` export (import will fail — that's the expected first failure).
- [ ] Run: `npx tsx --test src/index.test.ts` — expect FAIL (import error).
- [ ] Implement `parallel_task_result` in `src/index.ts` per the contract above, plus the exported `TASK_RESULT_TIMEOUT_DEFAULT`/`TASK_RESULT_TIMEOUT_MAX` constants.
- [ ] Run: `npx tsx --test src/index.test.ts` — expect PASS, all 9 new tests plus every prior test green.
- [ ] Add the inline ASCII lifecycle diagram (copy the "Async task lifecycle" block from the spec, lines 181-196) as a comment directly above the `parallel_task_result` export in `src/index.ts`.
- [ ] Run `npm run typecheck` — expect exit 0.
- [ ] Commit: `git commit -m "feat(parallel-search): add parallel_task_result wrapper with run_id-preserving timeout handling"`.
- [ ] Push, open PR: `gh pr create --base main --title "feat(parallel-search): parallel_task_result wrapper" --body "..."`.

---

## Task 5 (T5 — PR 5 of 5): Charlie deep-research Task Run routing

Branch from `main` after T4 merges.

**Files:**
- Modify: `skills/parallel-search/src/charlie-deep-research-adapter.ts`
- Modify: `skills/parallel-search/src/charlie-deep-research-adapter.test.ts`

**Interfaces:**
- Consumes: `parallel_task`, `parallel_task_result`, `TASK_RESULT_TIMEOUT_DEFAULT` from T4's `src/index.ts`.
- Produces: `charlieDeepResearchSearch` gains an `options.taskRun?: boolean` branch; return type stays `CharlieResearchRecord[]` (`{ title, url, snippet }[]`), unchanged for callers not opting in.

**Contract (spec "Deep-research routing (phase 2)"):**

- `options.taskRun === true` (or `CHARLIE_PARALLEL_TASKRUN` env flag, mirroring the existing `isEnabled` pattern): call `parallel_task({ input: objective, processor: process.env.CHARLIE_PARALLEL_PROCESSOR?.trim() || 'core' })`, then `parallel_task_result({ run_id, wait: true, timeout_seconds })`.
- If `parallel_task` succeeds but `parallel_task_result` fails: surface the error **with the `run_id` from the `parallel_task` response** attached — even if `parallel_task_result`'s own error didn't carry one (e.g. a non-timeout failure), the adapter is responsible for attaching it, since it has the `run_id` from the prior call and the run is otherwise unrecoverable-looking to the caller.
- Normalize `output.basis[].citations[]` (`{ url, title?, excerpts? }`) into `{ title, url, snippet }[]` using the same drop-if-missing-title-or-invalid-url rule as the existing `normalize()`, and the same excerpts[0]-or-empty-string rule for `snippet`. Factor this into a shared helper both the Search-path `normalize()` and the new Task-Run-path normalizer call, rather than duplicating the drop/shape rules.
- Search stays the default path; `taskRun` is opt-in only.

**Test list:**

- Default (`taskRun` unset or `false`): behavior unchanged from T1 — existing 4 adapter tests still pass verbatim.
- `taskRun: true`: mock `clientFactory` with `taskRun.create` returning a queued run and `taskRun.result` returning a `TaskRunResult` with `output.basis` containing 2 citations (one valid, one missing `title`); assert the returned `CharlieResearchRecord[]` has exactly 1 entry, correctly normalized from `citations[]`.
- `taskRun: true`, `parallel_task` succeeds, `parallel_task_result` throws (times out): assert the adapter's returned error carries the `run_id` from the `parallel_task` response.
- `taskRun: true`, `parallel_task` itself fails (e.g. `INVALID_INPUT` from a malformed processor): assert the adapter surfaces that error code with no `run_id` (there is no run to recover).

**Steps:**

- [ ] Write the 3 new tests (plus re-run the 4 existing ones unmodified) against the not-yet-updated adapter.
- [ ] Run: `npx tsx --test src/charlie-deep-research-adapter.test.ts` — expect the 3 new tests to FAIL, the 4 existing ones to still PASS.
- [ ] Implement the `taskRun` branch and the shared citation-normalization helper in `charlie-deep-research-adapter.ts` per the contract above.
- [ ] Run: `npx tsx --test src/charlie-deep-research-adapter.test.ts` — expect PASS, all 7 tests.
- [ ] Run full suite: `npm test && npm run typecheck` from `skills/parallel-search/` — expect both exit 0.
- [ ] Commit: `git commit -m "feat(parallel-search): wire Charlie adapter Task Run path (phase 2)"`.
- [ ] Push, open PR: `gh pr create --base main --title "feat(parallel-search): Charlie adapter Task Run routing" --body "..."`.

---

## Housekeeping (independent, not T1-T5, can run in a parallel lane per spec)

Defects 9 and 11 — version/name drift and `node_modules`/lockfile intent. Touches only `SKILL.json`, `package.json`, `.gitignore`, `SKILL.md`. Not scheduled here; spec's resolved decision already settles the policy (in-repo only, `node_modules/` gitignored, `package-lock.json` committed) — pick this up whenever convenient, same one-PR-per-task rule applies if you do.

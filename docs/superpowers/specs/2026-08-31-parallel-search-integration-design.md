# Parallel search integration — design specification (v1.2)

- Status: draft, recovery spec written after implementation. Folded in `/plan-eng-review` findings 2026-09-01; all 5 open questions resolved by operator decision 2026-09-01.
- Author: Chris Sorensen.
- Date: 2026-09-01.
- Repository: `toolforge` (`git@github.com:sorensencc-dotcom/toolforge.git`).
- Skill: `skills/parallel-search/`.
- Related: `docs/meta/skill-operator-guide.md`, `skills/parallel-search/SKILL.md`.

## Overview

`skills/parallel-search/` provides fail-closed TypeScript wrappers around the
Parallel web-data APIs (`parallel-web` npm package) plus a Cast Iron Charlie
deep-research adapter that consumes them. The code shipped to `origin/main`
across pull request #15 (`658da2aa`) and follow-up `bff19bbf` without a design
document. This specification is written after the fact to lock the intended
contract, record the gap between the shipped code and the real
`parallel-web@0.3.x` SDK, and define the remaining work.

The reconstructed objective, taken from `SKILL.md`, the adapter source, and the
external milestone the implementation was chasing:

> Provide deterministic, credential-safe TypeScript access to Parallel's
> current-web search, URL extraction, and asynchronous research Task Run APIs,
> consumed by a Cast Iron Charlie deep-research path. Task result retrieval is
> explicitly deferred to a later phase.

## Goals

1. Expose a small, stable, fail-closed API surface (`{ ok: true, data } | { ok: false, error }`) over Parallel Search, Extract, and Task Run creation.
2. Validate every input before any network call.
3. Never leak provider credentials or raw provider exception text through error values.
4. Give the Charlie deep-research consumer a normalized `{ title, url, snippet }[]` contract that is disabled by default and opt-in through configuration.
5. Match the real `parallel-web` SDK call paths and response shapes, verified against the installed package version, not a hand-built mock. The type system, not the runtime `catch`, is the first line of defence: an illegal call path must fail `tsc`, not fail silently at run time.
6. Ship the deferred Task Run result-retrieval wrapper (`create` then `retrieve`/`result`) under the same fail-closed contract, with no orphaned runs on the timeout path.

## Non-goals

- Parallel Beta `findall` (entity discovery), `task-group` (batch task orchestration), webhooks, streaming task events, and MCP-server task tooling. These are separate surfaces and out of scope for this skill.
- Response caching and rate limiting. Retry policy stays at the SDK default (`maxRetries: 2`). See "Performance considerations" for the token-cost and connection-hold implications the caller must manage.
- A CLI entry point. The skill exports functions only.
- Cost accounting and budget enforcement. If required, that belongs to the caller against `CIC-AI-AGENT-COST-SPEC-001`, not this wrapper. Open question 4 tracks whether Task Run creation must gate on a workspace ceiling.

## SDK contract (`parallel-web`)

The shipped implementation was written against an assumed client shape. The
following is the surface of the installed package, `parallel-web@0.3.2`,
verified from `node_modules/parallel-web/**/*.d.ts`. Reconcile the wrappers with
this, and pin the dependency to a caret range that has been tested
(`"parallel-web": "^0.3.2"`).

### Client construction

```ts
import Parallel from "parallel-web";
const client = new Parallel({ apiKey }); // reads process.env.PARALLEL_API_KEY when apiKey omitted
```

### Search — `client.beta.search(params)`

- Path: `client.beta.search`, **not** `client.search`. Lives on the `beta` resource.
- Params (`BetaSearchParams`): `objective?: string`, `search_queries?: string[]`, `max_results?: number` (default 10), `mode?: 'one-shot' | 'agentic' | 'fast'`, `excerpts?`, `fetch_policy?`, `source_policy?`. **At least one of `objective` or `search_queries` is required.** The deprecated `processor?: 'base' | 'pro'` param is superseded by `mode`.
- Response (`SearchResult`): `{ results: WebSearchResult[], search_id: string, usage?: UsageItem[], warnings?: Warning[] }`.
- `WebSearchResult`: `{ url: string, excerpts?: string[] | null, publish_date?: string | null, title?: string | null }`. There is **no `snippet` field and no `link` field**; excerpt text is in `excerpts: string[]`.

### Extract — `client.beta.extract(params)`

- Path: `client.beta.extract`, **not** `client.extract`.
- Requires the beta header `parallel-beta: search-extract-2025-10-10`. Pass it through `betas: ['search-extract-2025-10-10']` on the params or as a default header on the client.
- Params (`BetaExtractParams`): `urls: string[]`, `excerpts?: boolean | ExcerptSettings`, `full_content?: boolean | { max_chars_per_result }`, `objective?: string`, `search_queries?: string[]`.
- Response (`ExtractResponse`): `{ results: ExtractResult[], errors: ExtractError[], extract_id: string, usage?, warnings? }`.
- `ExtractResult`: `{ url: string, excerpts?: string[] | null, full_content?: string | null, publish_date?: string | null, title?: string | null }`. URLs that fail come back in `errors`, not `results`. A call where every URL fails still resolves with HTTP 200 and a populated `errors` array — the wrapper treats that as a successful call returning partial data, and the caller must inspect `errors`.

### Task Run — `client.taskRun.*`

- `create(body: TaskRunCreateParams): Promise<TaskRun>` — returns immediately with `status: 'queued'`.
  - `TaskRunCreateParams`: `input: string | Record<string, unknown>`, `processor: string`, `metadata?`, `previous_interaction_id?`, `source_policy?`, `task_spec?: TaskSpec`.
- `retrieve(runId: string): Promise<TaskRun>` — status poll, non-blocking.
- `result(runId: string, query?: { timeout?: number }): Promise<TaskRunResult>` — blocks until the run completes (or the timeout elapses). The `timeout` is in seconds.
- `TaskRun`: `{ run_id: string, interaction_id: string, processor: string, is_active: boolean, status: 'queued' | 'action_required' | 'running' | 'completed' | 'failed' | 'cancelling' | 'cancelled', created_at: string | null, modified_at: string | null, error?: ErrorObject | null, metadata?, taskgroup_id?, warnings? }`.
- `TaskRunResult`: `{ output: TaskRunTextOutput | TaskRunJsonOutput, run: TaskRun }`.
  - `TaskRunTextOutput`: `{ type: 'text', content: string, basis: FieldBasis[] }`.
  - `TaskRunJsonOutput`: `{ type: 'json', content: Record<string, unknown>, basis: FieldBasis[], output_schema? }`.
  - `FieldBasis`: `{ field, reasoning, citations?: Citation[], confidence?: string | null }`; `Citation`: `{ url, title?, excerpts? }`.
- Processors: the SDK types `processor` as a bare `string`. The published processor names (`lite`, `base`, `core`, `pro`, `ultra`) come from the Parallel documentation, not the types. Treat `base` as the default and pass the value through unvalidated except for the non-empty check.

### Errors

The SDK throws `Parallel.APIError` subclasses (`BadRequestError`, `AuthenticationError`, `RateLimitError`, `InternalServerError`, `APIConnectionError`, `APIConnectionTimeoutError`, and others) with `.status`, `.name`, and `.headers`. The wrappers catch all of these and collapse them to a single opaque error code; they never re-expose `.message`, `.headers`, or the request body to the caller. An opt-in debug sink (below) is the only channel that ever sees the raw error.

## Public API surface

All exports live in `skills/parallel-search/src/index.ts` and return
`Promise<OperationResult<T>>` where:

```ts
type OperationResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };
type ErrorCode = "API_KEY_MISSING" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "PARALLEL_API_ERROR";
```

### Internal structure (applies to every wrapper)

- **Type the client against the real SDK.** Delete the hand-rolled structural `Client` type. Type `clientFactory` and the internal client as `Pick<Parallel, "beta" | "taskRun">` (import `type Parallel from "parallel-web"`). Remove the `as unknown as Client` cast. After this change, `client.search(...)` is a compile error rather than a runtime `TypeError` swallowed by `catch`. This is the single change that would have caught defects 1 and 3 at author time; it depends on the `tsconfig.json` from defect 5.
- **Share the operation skeleton.** The three shipped wrappers each repeat `validate -> Promise.resolve(error(...)) -> call(...)`. Before adding `parallel_task_result` (the fourth), extract `defineOperation(validate, networkFn, responseGuard)` so each wrapper body is the validator plus one call. Refactor first, then add the new operation (make the change easy, then make the easy change).
- **Debug sink.** `RuntimeOptions` gains `onError?: (err: unknown) => void`. The `catch` block calls `options.onError?.(err)` before returning the opaque `PARALLEL_API_ERROR`, and also `console.error(err)` when `process.env.PARALLEL_DEBUG` is set. The caller-facing return value is unchanged; the raw error never enters `OperationResult`. This is what makes the live smoke test (defect 7) able to report a real cause.

### `parallel_search(input, options?)`

- `input`: `{ objective?: string; search_queries?: string[]; mode?: 'one-shot' | 'agentic' | 'fast' }`.
- Validation: `objective` is a non-empty string **or** `search_queries` is a non-empty array of non-empty strings (mirror the SDK rule: at least one of the two). No 2–3 element cap; that limit appears nowhere in the Parallel API and must be removed.
- Network: `client.beta.search({ objective, search_queries, mode: input.mode ?? 'agentic' })`. `agentic` is the default because it returns concise, token-efficient results (see "Performance considerations"); callers that want fuller results pass `mode: 'one-shot'`.
- Output: the raw `SearchResult` object as `SearchOutput`. The response guard requires a non-array object **whose `results` property is an array** — not merely "is an object". A shape drift (`results` renamed or missing) must surface as `INVALID_API_RESPONSE` at this layer, not as a confusing failure inside the Charlie adapter.

### `parallel_extract(input, options?)`

- `input`: `{ urls: string[]; objective?: string }`.
- Validation: 1–20 URLs, every URL a valid `http:` or `https:` URL; `objective`, if present, non-empty.
- Network: `client.beta.extract({ urls, objective?, betas: ['search-extract-2025-10-10'] })`.
- Output: raw `ExtractResponse` as `ExtractOutput`; response guard requires `results` and `errors` to both be arrays. The wrapper does not treat a fully-failed batch as an error — see the SDK contract note.

### `parallel_task(input, options?)`

- `input`: `{ input: string | Record<string, unknown>; processor: string }`.
- Validation: `input` is a non-empty string, or a non-array object **with at least one own key** (reject `{}`); `processor` is a non-empty string.
- Network: `client.taskRun.create({ input, processor })`.
- Output: `TaskOutput` — the subset `{ run_id, interaction_id, status, is_active, processor }`. The response guard requires all five present and correctly typed. This subset is a valid narrowing of the real `TaskRun` shape and is retained.
- Contract note: creation is fire-and-forget. The caller **must** subsequently call `parallel_task_result` (poll or wait) or explicitly abandon the run. A created run that is never polled keeps consuming provider resources; the wrapper cannot detect or clean that up.

### `parallel_task_result(input, options?)` — deferred, to be built

- `input`: `{ run_id: string; wait?: boolean; timeout_seconds?: number }`.
- Validation: `run_id` non-empty string; `timeout_seconds`, if present, a positive number `<= TASK_RESULT_TIMEOUT_MAX` (`600`, fixed operating value — see "Resolved decisions"). When `wait === true` and `timeout_seconds` is omitted, default to `TASK_RESULT_TIMEOUT_DEFAULT` (`300`), not the SDK's 60 s, which is too short for a research task.
- Network:
  - `wait !== true`: `client.taskRun.retrieve(run_id)` → return the narrowed `TaskRun` status object.
  - `wait === true`: `client.taskRun.result(run_id, { timeout: timeout_seconds ?? TASK_RESULT_TIMEOUT_DEFAULT })` → return `{ status, output }` where `output` is `{ type, content, basis }`.
- Output guard: for the status path, the same five-field `TaskRun` subset; for the result path, `output.type` is `'text' | 'json'`, `output.content` is present, `output.basis` is an array.
- Fail-closed:
  - A settled-but-unsuccessful run (`status` in `failed`, `cancelled`, `action_required`) returns `{ ok: true, data: { status, run_id, ... } }` — the call succeeded, the run did not. Not a `PARALLEL_API_ERROR`.
  - A `wait: true` call that times out before the run settles returns `{ ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } }` **and** attaches the `run_id` on a typed side channel so the caller can re-poll: the error object carries `run_id?: string`. Losing the `run_id` here orphans the run.
  - A transport failure or unparseable body is `PARALLEL_API_ERROR` / `INVALID_API_RESPONSE` as usual.

## Error model

| Code | Cause | Message (fixed, no interpolation of provider text) |
|---|---|---|
| `API_KEY_MISSING` | No `apiKey` option and no `PARALLEL_API_KEY` env var | `PARALLEL_API_KEY is required` |
| `INVALID_INPUT` | Input failed local validation before any network call | Per-operation static string describing the contract |
| `PARALLEL_API_ERROR` | Any thrown SDK error, transport failure, or timeout | `Parallel request failed` |
| `INVALID_API_RESPONSE` | Network call resolved but the body failed the response guard | `Parallel returned an invalid response` |

Rules:

- Validation runs to completion before `clientFor` is called; an invalid input never constructs a client or touches the network.
- The `catch` block passes the caught value to `options.onError` and the `PARALLEL_DEBUG` console sink, then discards it. No `err.message`, `err.status`, or `err.stack` reaches the caller through `OperationResult`.
- Error `message` strings are module-level constants. They never embed URLs, queries, keys, or run identifiers. The only structured field ever added to an error is `run_id` on the `parallel_task_result` timeout path, and it is a plain run identifier, not provider text. A unit test asserts `error()` is only ever called with one of the known constants.

## Charlie deep-research consumer contract

`skills/parallel-search/src/charlie-deep-research-adapter.ts` exports
`charlieDeepResearchSearch(topic, persona, options?)`.

- Disabled by default. Enabled only when `options.enabled === true` or `CHARLIE_PARALLEL_SEARCH_ENABLED` is one of `1`, `true`, `yes` (case-insensitive). Otherwise returns `{ ok: false, error: { code: "FEATURE_DISABLED" } }`.
- Input: `topic` and `persona` are both non-empty strings; otherwise `INVALID_INPUT`.
- Behavior: builds a Parallel search with `objective = "Research <topic> from the perspective of <persona>"` and the query set returned by a named helper `charlieResearchQueries(topic)` — currently `[topic, "<topic> history", "<topic> primary sources"]`, defined as one documented constant rather than three inline string literals, because it encodes the Cast Iron Charlie historical / primary-source bias and must be reviewable and overridable in one place. The adapter passes `mode: 'agentic'` for token efficiency.
- Normalization: reads `SearchResult.results[]`; for each item emits `{ title, url, snippet }` where `title` and `url` are required strings, `url` matches `^https?://`, and `snippet` is `excerpts?.[0] ?? ""`. Items missing `title` or a valid `url` are dropped. The shipped adapter reads a non-existent `snippet` field and a non-existent `link` field; it must be updated to read `excerpts[0]` and `url`, and drop the `link` fallback. This is a regression fix — see the test strategy.
- Error mapping: any non-`ok` result from `parallel_search` is surfaced as `{ ok: false, error: { code } }` with the underlying `ErrorCode`; a structurally invalid body maps to `INVALID_API_RESPONSE`.
- Adapter error codes: `type AdapterErrorCode = ErrorCode | "FEATURE_DISABLED"` — defined in terms of `ErrorCode` so the two unions cannot drift.

### Deep-research routing (phase 2)

Once `parallel_task_result` exists, `charlieDeepResearchSearch` gains an
opt-in path that routes through Task Run instead of Search:

- `options.taskRun === true` (or a dedicated env flag): call `parallel_task({ input: objective, processor: 'core' })`, then poll `parallel_task_result({ run_id, wait: true, timeout_seconds })`.
- If `parallel_task` succeeds but `parallel_task_result` fails, the adapter surfaces the error **with the `run_id`** it got from `parallel_task`, so the run is recoverable rather than orphaned.
- The normalized return type stays `{ title, url, snippet }[]`, derived from `output.basis[].citations[]` (`{ url, title, excerpts }`) when the task output is used.
- Search remains the default; Task Run is the explicit "deep" path, consistent with the split between `parallel-web-search` and `parallel-deep-research` elsewhere in the workspace.

## Async task lifecycle

```
parallel_task(create)  ->  { run_id, status: 'queued', is_active: true }
                              |
                              v
parallel_task_result(run_id, wait:false)  ->  { status: 'running' | 'queued' | 'completed' | ... }
                              |
              status == 'completed'  ────────────────┐
                              |                       |
              wait:true (delegates to result())       |
                              v                       v
parallel_task_result(run_id, wait:true)   ->  { status: 'completed', output: { type, content, basis } }
                              |
              timeout before settle
                              v
              { ok:false, error:{ code:'PARALLEL_API_ERROR', run_id } }   // run NOT orphaned
```

- Creation never blocks. The caller owns the poll loop unless it opts into `wait: true`.
- `wait: true` delegates blocking to `client.taskRun.result`, which accepts a `timeout` (seconds) and returns when the run settles.
- Terminal non-success states (`failed`, `cancelled`, `action_required`) are returned as data, not errors.
- This diagram, or a reduced form of it, belongs inline as an ASCII comment above `parallel_task_result` in `src/index.ts`.

## Defects in the shipped implementation

Each item is a requirement for the fix-up work. Priority: **P0** breaks every real call or corrupts the Charlie path; **P1** is cheap correctness or tooling that makes P0 verifiable; **P2** is housekeeping.

1. **[P0] Wrong SDK call paths.** `index.ts` calls `client.search(...)` and `client.extract(...)`. The real methods are `client.beta.search(...)` and `client.beta.extract(...)`. Every non-mocked call currently throws and is swallowed as `PARALLEL_API_ERROR`. Fix: replace the hand-rolled `Client` structural type and the `as unknown as Client` cast with `Pick<Parallel, "beta" | "taskRun">` from the SDK, then fix the call sites — the wrong paths then fail `tsc` instead of at run time.
2. **[P0] Invented `search_queries` cap.** The `length < 2 || length > 3` rule has no basis in the Parallel API. Replace with "at least one of `objective` or `search_queries`", matching the SDK.
3. **[P0] Extract beta header missing.** `client.beta.extract` requires `parallel-beta: search-extract-2025-10-10`. Add it via `betas: [...]`.
4. **[P1] `README.md` and `tests/README.md` corruption.** Both files contain literal `` `n`n `` PowerShell here-string escape sequences instead of newlines. Rewrite both with real line breaks.
5. **[P1] No `tsconfig.json`.** The skill has no TypeScript configuration, so nothing type-checks; `tsx` strips types at run time. Commit messages claiming "TypeScript checks passed" are unverifiable. Add `skills/parallel-search/tsconfig.json` (`strict: true`, `moduleResolution: "nodenext"` or `"bundler"`, `noEmit: true`) and a `typecheck` script (`tsc -p tsconfig.json`). This is the change that gives defect 1 its teeth.
6. **[P1] `npm test` runs one of two suites.** The script is `tsx --test src/index.test.ts`; `src/charlie-deep-research-adapter.test.ts` never runs under `npm test`. `tsx --test a b` with multiple files silently runs only the first. Switch to a glob (`tsx --test 'src/**/*.test.ts'`) or an explicit multi-file form verified to run both, and assert the reported test count so a silently dropped suite fails the build.
7. **[P1] Zero real-API validation.** Every test mocks `clientFactory`. The `TaskOutput` guard, the `SearchResult` shape, and the adapter normalization have never been checked against `parallel-web@0.3.2` responses. Add a live smoke test (below).
8. **[P0] Adapter reads non-existent fields (regression).** `normalize()` reads `record.snippet` and `record.link`; neither exists on `WebSearchResult`. Read `excerpts[0]` and `url`. A regression test with a real-shaped `SearchResult` fixture is mandatory.
9. **[P2] Version drift and name-convention drift.** `SKILL.json` says `"version":"1.0.0"` and `name:"Parallel Search"`; `package.json` says `"0.1.0"`; `SKILL.md` frontmatter has `name: parallel-search` and no version. Pick `package.json` as the source of truth for version and align all three; settle on one `name` spelling.
10. **[P1] Stray working-tree file.** A zero-byte file named `{` exists under `skills/parallel-search/`. Delete it; it is local junk, not on any branch.
11. **[P2] `node_modules/` and `package-lock.json` committed under the skill.** Confirm intent (open question 1). If the skill is installed standalone, keep the lockfile and gitignore `node_modules/`; otherwise remove both from version control.

## Verification and test strategy

The shipped suites are ~8 mocked cases. The target below is ~28 cases plus one
live smoke file. The `npm test` count assertion (defect 6) makes any silently
dropped case a build failure.

### Regression (IRON RULE — highest priority, no deferral)

- **Adapter `normalize()` field mismatch (defect 8).** Feed a real-shaped fixture built from the `.d.ts` types: `{ search_id: "s_x", results: [{ url: "https://a.test", title: "A", excerpts: ["ex one"] }] }`. Assert the wrapper returns `{ ok: true, data: [{ title: "A", url: "https://a.test", snippet: "ex one" }] }`. This proves the fix and locks it.

### Unit (mocked, offline, runs in CI)

- Retain the `clientFactory` injection pattern.
- `parallel_search`: missing key; no `objective` and no `search_queries` → `INVALID_INPUT`; `objective`-only accepted; `search_queries`-only accepted; valid call passes `mode: 'agentic'` by default and the caller's `mode` when supplied; response with `results` not an array → `INVALID_API_RESPONSE`; happy body passes through.
- `parallel_extract`: 0 URLs; 21 URLs; non-http URL; valid call; `betas: ['search-extract-2025-10-10']` present on the outgoing params; response with every URL in `errors[]` and empty `results[]` → still `ok: true`.
- `parallel_task`: non-empty string input accepted; `{}` object input → `INVALID_INPUT`; non-empty object input accepted; empty `processor` → `INVALID_INPUT`; valid `TaskRun` subset accepted; missing `run_id` in response → `INVALID_API_RESPONSE`.
- `parallel_task_result`: `wait:false` status path returns the `TaskRun` subset; `wait:true` result path returns `{ status, output }`; `status: 'failed'` → `ok: true` data (not an error); `status: 'cancelled'` → `ok: true` data; `wait:true` timeout → `ok: false` with `error.run_id` set; transport throw → `PARALLEL_API_ERROR`; `timeout_seconds` over the max → `INVALID_INPUT`.
- Adapter: disabled by default; blank `topic` → `INVALID_INPUT`; blank `persona` → `INVALID_INPUT`; item missing `title` dropped; item with non-http `url` dropped; `parallel_search` error code passed through unchanged; `charlieResearchQueries("x")` returns the documented triple.
- Error hygiene: a test asserts every `error(...)` call site uses one of the known message constants (static check or a spy over `error`).
- Runner: `npm test` output is parsed and the total test count is asserted against an expected number.

### Live smoke (guarded, opt-in, not in default CI)

- One file, `src/*.smoke.test.ts`, skipped entirely when `PARALLEL_API_KEY` is absent (`node:test` conditional skip).
- Hits real endpoints once each: `client.beta.search` with a trivial `objective`, and `client.taskRun.create` with `processor: 'base'` and a trivial `input`.
- Asserts the real response shapes: `SearchResult` has `results` (array) and `search_id` (string); `TaskRun` has `run_id`, `interaction_id`, `status`, `is_active`, `processor`.
- Runs with `PARALLEL_DEBUG=1` so a failure prints the real SDK error.
- Does not assert on `taskRun.result` (cost, latency); a follow-up may add a bounded `wait` with a short `timeout`.
- Records the observed shapes as a committed fixture so the mocked tests stay honest.

### Type checking

- `npm run typecheck` (`tsc --noEmit`) runs in CI and in the pre-push hook.
- `strict` on. No `any` in the public surface; `unknown` plus guards only.
- After defect 1, a deliberate `client.search(...)` in a scratch file must fail `tsc` — verify once during the fix-up.

## Performance considerations

- **`parallel_task_result(wait: true)` holds a connection open for the run's duration** (minutes for research tasks). A consumer that fans out N topics with `wait: true` holds N long-lived connections. Batch and deep-research callers should use `wait: false` plus their own bounded poll loop; reserve `wait: true` for single interactive calls. The Charlie phase-2 path uses `wait: true` for one topic at a time.
- **Charlie search is 3 queries with `max_results` defaulting to 10** → up to 30 excerpt-bearing result objects per `charlieDeepResearchSearch` call. `mode: 'agentic'` (now the default) trims each result to token-efficient excerpts. If bulk runs still cost too much, lower `max_results` in the adapter.
- **No response caching.** Researching the same `topic` across multiple personas re-hits the API. Acceptable for v1; a memoisation layer keyed on `objective + queries` is a P3 follow-up if it shows up in cost telemetry.

## Failure modes

| Codepath | Realistic production failure | Test | Error handling | Caller sees |
|---|---|---|---|---|
| `parallel_task_result(wait:true)` | run exceeds `timeout_seconds` | yes (unit) | returns `PARALLEL_API_ERROR` **with `error.run_id`** so the run is recoverable | opaque error code plus a `run_id` to re-poll |
| `parallel_task` create, caller never polls | orphaned run, silent provider cost | no (out of wrapper control) | none — documented caller contract only | nothing; the contract note is the only guard |
| Charlie `taskRun:true` (phase 2): create ok, result throws | orphaned run | yes (unit) | adapter surfaces the error with the `run_id` from `parallel_task` | error code plus `run_id` |
| `parallel_extract` partial failure | some URLs in `errors[]`, not `results[]` | yes (unit) | passthrough; caller must read `errors[]` | partial data, `ok: true` |
| `beta.search` / `beta.extract` missing beta header | HTTP 400 | yes (header-present unit test) | caught → `PARALLEL_API_ERROR`; real cause visible only via `onError` / `PARALLEL_DEBUG` | opaque error code |

Residual risk after this spec: **an orphaned Task Run from `parallel_task` create with no follow-up poll** has no test and no automatic handling — only the caller contract. Accepted for v1 because the wrapper has no run registry; revisit if orphaned-run cost is observed.

## Rollout and process

- All fix-up and follow-up work happens on `feat/parallel-search-*` branches from a checkout under `C:\dev\dev-sandbox`, one pull request per task, human review before merge. `C:\dev` is treated as read-only.
- Do not delegate this work to Codex unattended. The recovery review attributes to the Codex track: the `` `n`n `` corruption, a stray `{` file, misleading green tests, the missing spec, and WSL/Windows hook confusion.
- Suggested sequence:
  1. This spec (done on merge).
  2. Fix-up pull request: defects 1–6, 8, 10 (SDK paths and client typing, query cap, beta header, READMEs, `tsconfig` + typecheck wiring, test runner + count assertion, adapter field fix + regression test, stray file).
  3. Live smoke test: defect 7; reconcile `SearchOutput` / `TaskOutput` typings against the SDK; confirm no query cap in the docs.
  4. Refactor the wrappers onto `defineOperation(...)` (no behaviour change; all existing tests stay green).
  5. `parallel_task_result`: build the deferred wrapper, the timeout / `run_id` handling, the inline ASCII diagram, and the five lifecycle tests.
  6. Deep-research routing: wire `charlieDeepResearchSearch` to the Task Run path behind a flag, with `run_id`-preserving error handling.
  7. Housekeeping: defects 9, 11 (version and name drift, committed `node_modules`). Independent of steps 2–6; can run in parallel.

## Parallelisation

Steps 2–6 all touch `src/index.ts` (and 6 also the adapter) and are sequential.
Step 7 touches only `SKILL.json`, `package.json`, `.gitignore`, and `SKILL.md`
and can run in a parallel lane. Not worth separate git worktrees — a single
branch with PR-per-step per the rollout is enough.

## Resolved decisions (from `/plan-eng-review`, 2026-09-01; operator decisions, 2026-09-01)

- **Search `mode`:** `parallel_search` accepts an optional `mode`; the Charlie adapter and the wrapper default both pin `agentic` for token efficiency. (Was open question 3.)
- **Client typing:** structural `Client` type replaced by `Pick<Parallel, "beta" | "taskRun">`; the `as unknown as` cast is removed. (From architecture finding A1.)
- **`wait:true` timeout:** returns `PARALLEL_API_ERROR` with `error.run_id` attached; default `timeout_seconds` is 300 s, max 600 s. (From architecture finding A2 / failure-mode review.)
- **Distribution (was OQ1):** in-repo only. The wrapper is tightly coupled to the Charlie deep-research path and CIC governance semantics; publishing standalone forces a public API stability contract not needed yet. `node_modules/` is gitignored, `package-lock.json` stays committed for reproducible in-repo installs. Reconsider only if a generalized Parallel Search skill is built for the Toolforge marketplace — closes defect 11.
- **Charlie Task Run processor (was OQ2):** `core` by default — Parallel's cost/capability middle tier; the adapter's citation normalization doesn't need top-tier reasoning. Override via an env flag (`CHARLIE_PARALLEL_PROCESSOR`) for experimentation, not a per-call param.
- **Timeout ceiling (was OQ3):** `TASK_RESULT_TIMEOUT_DEFAULT = 300`, `TASK_RESULT_TIMEOUT_MAX = 600`, fixed as the operating values (no longer a placeholder). Revisit only if Parallel documents a different guaranteed upper bound or a live smoke run shows runs settling later than 600 s.
- **Cost ceiling enforcement (was OQ4):** out of the wrapper, permanently — not deferred pending investigation. The wrapper stays pure, deterministic, and fail-closed; policy does not belong here. Ceiling enforcement against `CIC-AI-AGENT-COST-SPEC-001` happens in the CIC agent layer, before it calls `parallel_task` or `parallel_search`. Non-goals section already states this; this decision confirms no wrapper-side check is coming.
- **External Parallel milestone (was OQ5):** informational only, non-blocking. The spec already reconstructs the full SDK surface from `.d.ts` independent of Parallel's roadmap. Do not delay the fix-up PR sequence (steps 2–7) hunting for it. Revisit only when building phase-2 deep-research routing, or if Parallel ships a breaking SDK change. The phase-1 worktrees under `dev-sandbox/toolforge-parallel-phase1-20260830/` remain a pointer if anyone wants to look later, but nothing in this spec depends on finding it.

## Open questions

None outstanding. All five are resolved above.

## External references

- Parallel API documentation: <https://docs.parallel.ai>.
- `parallel-web` package API reference: `node_modules/parallel-web/api.md` (generated), and the `.d.ts` files under `node_modules/parallel-web/resources/`.
- Beta search and extract header: `parallel-beta: search-extract-2025-10-10`.
- Skill Operator Guide: `docs/meta/skill-operator-guide.md`.
- Writing discipline: `skills/writing-heuristics/SKILL.md`.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_folded | 12 issues (4 architecture, 5 code quality, 3 performance), ~20 test gaps incl. 1 critical regression, 2 critical failure-mode gaps — all folded into v1.1 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a (no UI) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG reviewed — findings folded into spec v1.1. All 5 open questions closed by operator decision 2026-09-01 (v1.2) — see "Resolved decisions". Outside voice (cross-model) not run: non-interactive session; re-run `/plan-eng-review` interactively or `codex exec` against this file for that pass. Not a ship gate for a spec doc.

NO UNRESOLVED DECISIONS

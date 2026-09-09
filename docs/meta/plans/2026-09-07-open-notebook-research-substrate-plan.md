# Open Notebook research substrate implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock and implement an isolated, local-only Open Notebook adapter and immutable TRM research receipts, with a separately owned Toolforge runtime-limit integration test.

**Architecture:** V1 adds no production substrate selection. TRM first characterizes the existing closed-loop script seam, then defines typed request/result and receipt contracts before implementing the Open Notebook HTTP adapter. Toolforge separately proves process-level enforcement; CIC remains canonical authority.

**Tech Stack:** Node.js ESM, TypeScript, existing TRM scripts, JSON Schema or equivalent runtime validation, SHA-256, HTTP loopback transport, Node test runner, Toolforge test harness.

**Spec:** `docs/meta/specs/2026-09-07-open-notebook-research-substrate-design.md`

## Global Constraints

- V1 is isolated adapter plus receipts; substrate selection is V2 behind a signed authority decision.
- Open Notebook access is loopback HTTP only; TRM does not access SurrealDB.
- No silent retry after an indeterminate invocation; replay requires operator resolution and an API contract proving idempotency.
- Provider/model response metadata must match the explicit WhichLLM selection in `_integration/model_selection.json`.
- Receipts use exactly `accepted`, `rejected`, `timed_out`, or `indeterminate`.
- TRM owns request-level limits and receipts; Toolforge owns process-level limits and orphan cleanup.
- Existing NotebookLM behavior remains unchanged; compatibility is tested through script-seam characterization, not a fictitious shared adapter.

---

### Task 1: Lock upstream and local API contract

**Files:**
- Modify: `docs/meta/specs/2026-09-07-open-notebook-research-substrate-design.md`
- Create: `tests/fixtures/open-notebook/health-response.json`
- Create: `tests/fixtures/open-notebook/invoke-response.json`
- Create: `tests/fixtures/open-notebook/replay-response.json`

**Interfaces:**
- Produces the pinned upstream git SHA, license record, loopback health method/path, invoke method/path, request/response fields, and replay/idempotency behavior required by later tasks.

- [ ] **Step 1: Record the upstream revision and API evidence.**

Inspect the upstream repository at `https://github.com/lfnovo/open-notebook`, record the tested commit SHA and license, and document the exact health, invoke, and replay endpoints in the spec. Reject the task if the API does not expose a documented idempotency mechanism; the spec must then require operator-resolved no-replay behavior.

- [ ] **Step 2: Add response fixtures from the pinned contract.**

Create one fixture for a successful health response, one for a successful invocation with complete model/provider/workflow/source metadata, and one for the documented replay response.

- [ ] **Step 3: Validate the contract artifact.**

Run `git diff --check` and the repository documentation validator. Expected: no whitespace or documentation-policy violations.

- [ ] **Step 4: Commit.**

```text
git add docs/meta/specs/2026-09-07-open-notebook-research-substrate-design.md tests/fixtures/open-notebook
git commit -m "docs: lock Open Notebook HTTP contract"
```

### Task 2: Characterize the existing TRM research seam

**Files:**
- Modify: `scripts/run-closed-loop-research-v2.mjs`
- Test: `tests/run-closed-loop-research-seam.test.mjs`

**Interfaces:**
- Consumes: the existing `trm mine-notebooklm`, `notebooklm`, and `_integration/model_selection.json` calls.
- Produces: characterization assertions proving current NotebookLM orchestration remains unchanged and identifying the future adapter insertion boundary.

- [ ] **Step 1: Write characterization tests.**

Assert that Step 0 reads the WhichLLM selection record, Step 1 invokes `trm mine-notebooklm`, Step 2 uses the configured NotebookLM CLI, and dry-run mode prevents live upload.

- [ ] **Step 2: Run the focused test.**

Run `node --test tests/run-closed-loop-research-seam.test.mjs`. Expected: the new assertions fail only where the seam is not yet observable.

- [ ] **Step 3: Add the smallest observable seam.**

Expose an internal testable command-builder or dependency-injection boundary without changing default CLI behavior or introducing substrate selection.

- [ ] **Step 4: Run focused and regression tests.**

Run the focused test, then `node --test tests/notebooklm-uploader.test.ts` through the repository’s configured test runner. Expected: all pass.

- [ ] **Step 5: Commit.**

```text
git add scripts/run-closed-loop-research-v2.mjs tests/run-closed-loop-research-seam.test.mjs
git commit -m "test: characterize TRM research script seam"
```

### Task 3: Add typed TRM request, result, policy, and receipt contracts

**Files:**
- Create: `src/research-substrate/types.ts`
- Create: `src/research-substrate/policy.ts`
- Create: `src/research-substrate/receipt.ts`
- Test: `tests/research-substrate-contract.test.ts`

**Interfaces:**
- `ResearchRequest`: correlation ID, workspace ID, operator ID, source references, workflow intent, provider opt-in, prompt/input, timeout, and output ceiling.
- `ResearchResult`: correlation ID, normalized draft, source references, model identity, provider, workflow ID, and outcome.
- `ResearchReceipt`: canonical request digest, output digest, metadata, receipt path, and one of the four outcomes.
- `validatePolicy(request, selection): PolicyDecision`.
- `buildReceipt(request, result): ResearchReceipt`.

- [ ] **Step 1: Write failing schema and policy tests.**

Cover required identity fields, closed workflow-intent values, forbidden canonical-write intents, WhichLLM provider/model matching, all four outcomes, canonical serialization, and rejection of unknown fields where strict validation is required.

- [ ] **Step 2: Run the focused test.**

Run `npm test -- --runInBand tests/research-substrate-contract.test.ts`. Expected: FAIL because the contract modules do not exist.

- [ ] **Step 3: Implement strict types and runtime validation.**

Use explicit discriminated unions for outcomes and policy decisions. Reuse the existing TRM lineage hasher at `lineage/hasher.ts` where available; otherwise stop and add the exact existing hasher path to the spec before proceeding.

- [ ] **Step 4: Run focused tests and type checks.**

Run the focused test and `npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit.**

```text
git add src/research-substrate tests/research-substrate-contract.test.ts
git commit -m "feat: add research substrate contracts"
```

### Task 4: Implement the isolated Open Notebook HTTP adapter

**Files:**
- Create: `src/research-substrate/open-notebook-local.ts`
- Test: `tests/open-notebook-local.test.ts`
- Test: `tests/fixtures/open-notebook/*.json`

**Interfaces:**
- `OpenNotebookLocalAdapter.run(request: ResearchRequest): Promise<ResearchResult>`.
- `OpenNotebookLocalAdapter.health(): Promise<HealthResult>`.

- [ ] **Step 1: Write failing adapter tests.**

Use the pinned fixtures and a loopback mock server to cover successful normalization, malformed responses, timeout, output ceiling, provider mismatch, remote endpoint rejection, and operator-resolved indeterminate replay.

- [ ] **Step 2: Run the focused test.**

Run `npm test -- --runInBand tests/open-notebook-local.test.ts`. Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter against the pinned HTTP contract.**

Validate policy before transport, call only documented loopback paths, enforce request-level timeout and output limits, never silently retry, and return normalized metadata without exposing Esperanto or Open Notebook-specific shapes.

- [ ] **Step 4: Add failure-atomic receipt persistence.**

Write canonical receipt bytes to a same-directory temporary file, flush and close it, rename atomically to the content-addressed receipt path, and remove the temporary file on failure. Test interrupted writes and duplicate correlation IDs.

- [ ] **Step 5: Run adapter, contract, and regression tests.**

Run both focused suites and the existing TRM test command with a hard timeout. Expected: PASS with no NotebookLM behavior change.

- [ ] **Step 6: Commit.**

```text
git add src/research-substrate tests/open-notebook-local.test.ts tests/fixtures/open-notebook
git commit -m "feat: add isolated Open Notebook adapter"
```

### Task 5: Add Toolforge runtime-boundary integration test

**Repository:** `C:\dev\dev-sandbox\toolforge-herdr-trm-integration`

**Files:**
- Create: `tests/open-notebook-runtime-boundary.test.mjs`
- Modify: `package.json` only if a dedicated focused test command is needed.

**Interfaces:**
- Consumes: the Toolforge managed-process API and the TRM adapter’s local health contract.
- Produces: evidence that CPU, memory, concurrency, timeout, and orphan-cleanup limits are enforced at the process-group boundary.

- [ ] **Step 1: Confirm the process-control owner and test command.**

Inspect the Toolforge package manifest and managed-process implementation on its `main` branch. If no managed-process owner exists, stop this task and record the missing runtime owner as a blocking architecture decision; do not create a duplicate supervisor in this test.

- [ ] **Step 2: Write failing integration tests.**

Cover a process exceeding each configured ceiling, concurrent job rejection, timeout termination, orphan cleanup, and a healthy loopback API process.

- [ ] **Step 3: Run the focused Toolforge test.**

Run the package’s configured focused test command with a hard timeout. Expected: FAIL for missing coverage.

- [ ] **Step 4: Implement only the missing test harness wiring.**

Reuse existing Toolforge process controls; do not duplicate them in TRM.

- [ ] **Step 5: Run focused and Toolforge regression tests.**

Record local test output separately from live deployment evidence.

- [ ] **Step 6: Commit in the Toolforge sandbox.**

```text
git add tests/open-notebook-runtime-boundary.test.mjs package.json
git commit -m "test: verify research substrate runtime limits"
```

## Completion gate

Do not enable substrate selection or parallel production use until the TRM contract is pinned and tested, the Toolforge runtime integration test passes, the signed V2 authority decision exists, and a labeled live local smoke test succeeds.

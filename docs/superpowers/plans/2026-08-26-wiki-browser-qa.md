# Wiki browser QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, browser-backed Wiki audit exposed as `npm run wiki:qa`, with local-mirror tests and explicit diagram-policy enforcement.

**Architecture:** Keep the implementation inside `tools/wiki-browser-qa/`. Pure checks consume normalized browser observations; the adapter is the sole boundary to the gstack executable; the runner owns lifecycle, crawl scheduling, retries, partial reports, and exit status. Reuse the existing sync script for source-side rules and keep live auditing separate from local deterministic tests.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON policy/report files, gstack browser executable, existing Wiki sync script.

**Spec:** `docs/superpowers/specs/2026-08-26-wiki-browser-qa-design.md`

## Global Constraints

- Do not publish, edit, repair, or authenticate against Wiki content.
- Default target is `https://github.com/sorensencc-dotcom/toolforge/wiki`; support `WIKI_QA_BASE_URL`, `WIKI_QA_PAGES`, `WIKI_QA_REPORT`, `WIKI_QA_CONCURRENCY`, and `WIKI_QA_TIMEOUT_MS`.
- Do not silently fall back to HTTP-only checks when browser setup fails.
- Retry transient navigation/network failures only; never retry assertion failures.
- Write partial reports on timeout/interruption and exit non-zero for failures or unfinished pages.
- Exclude credentials, cookies, and provider calls from implementation and reports.

### Task 1: Define pure check contracts with failing tests

**Files:**
- Create: `tools/wiki-browser-qa/test/checks.test.mjs`
- Create: `tools/wiki-browser-qa/checks.mjs`

**Interfaces:**
- Produce `checkPageObservation(observation, policyRule)` returning serializable check results for heading, title/readability, frontmatter, links, console/network failures, images, overflow, and diagram evidence.
- Produce small exported helpers so malformed metadata, duplicate headings, broken images, invalid links, missing diagrams, and valid pages can be tested independently.

- [ ] Write tests for one meaningful H1, human-readable title/heading, hidden YAML, link/image/network failures, responsive overflow, and diagram evidence requirements.
- [ ] Run `node --test tools/wiki-browser-qa/test/checks.test.mjs`; confirm failure because `checks.mjs` is absent.
- [ ] Implement pure helpers with stable `{name, passed, details}` results and no browser or filesystem side effects.
- [ ] Re-run the focused test until green, then commit as `test: define Wiki QA checks` only if repository policy permits incremental commits.

### Task 2: Define adapter protocol with fake-executable tests

**Files:**
- Create: `tools/wiki-browser-qa/test/browser-adapter.test.mjs`
- Create: `tools/wiki-browser-qa/browser-adapter.mjs`

**Interfaces:**
- Produce `createBrowserAdapter(options)` with `checkExecutable()`, `openPage(url, options)`, `close()`, and normalized observations.
- Parse successful JSON-line responses; classify missing executable, setup/version errors, timeout, malformed output, console errors, failed requests, DOM assertions, and viewport observations.

- [ ] Write tests for command construction, JSON response normalization, setup failure diagnostics, timeout, malformed output, and a fake executable smoke interaction.
- [ ] Run the adapter test and confirm expected missing-module/API failures.
- [ ] Implement the smallest subprocess adapter around the configured gstack executable, including expected setup command/version diagnostics.
- [ ] Re-run adapter tests and verify no credentials/cookies enter commands or reports.

### Task 3: Add policy and policy-completeness tests

**Files:**
- Create: `tools/wiki-browser-qa/diagram-policy.json`
- Create: `tools/wiki-browser-qa/test/policy.test.mjs`
- Modify: existing architecture/provider Wiki source or generated-artifact references only if policy validation identifies a real missing mapping.

**Interfaces:**
- Policy schema maps page slugs to accepted selectors/patterns, source asset paths, required alt/caption evidence, and desktop/mobile requirements.
- Tests validate every classified architecture/provider page is listed and every source mapping resolves to a repository asset or generated artifact.

- [ ] Write policy tests that reject an unlisted classified page and nonexistent source mapping.
- [ ] Run tests to observe failure with no policy.
- [ ] Encode the approved initial page set and stable source mappings without adding ordinary narrative/research pages.
- [ ] Run policy tests and a JSON/schema sanity check until green.

### Task 4: Build runner, crawl behavior, reporting, and CLI tests

**Files:**
- Create: `tools/wiki-browser-qa/test/runner.test.mjs`
- Create: `tools/wiki-browser-qa/runner.mjs`
- Modify: `package.json`

**Interfaces:**
- `runWikiQa(env, dependencies)` discovers from Wiki index or explicit slugs, deduplicates URLs, applies bounded concurrency and transient-only retries, and returns a report plus process exit code.
- Report includes target, timestamp, page URL/slug, check results, console errors, failed requests, diagram evidence/source mapping, viewport results, and aggregate counts.

- [ ] Write runner tests for explicit page selection, dedupe, concurrency bounds, transient retry, assertion non-retry, partial timeout report, report-path override, and non-zero failures.
- [ ] Run tests to confirm runner is missing.
- [ ] Implement runner using injected adapter/filesystem/clock dependencies for deterministic tests; wire `npm run wiki:qa` to `node tools/wiki-browser-qa/runner.mjs`.
- [ ] Re-run focused tests and inspect generated JSON for secret/cookie exclusion.

### Task 5: Add fixtures, documentation, and verification commands

**Files:**
- Create: `tools/wiki-browser-qa/test/fixtures/passing-page.html`
- Create: `tools/wiki-browser-qa/test/fixtures/failing-page.html`
- Create: `tools/wiki-browser-qa/README.md`
- Modify: CI workflow/docs only where the existing repository workflow has a suitable Wiki QA artifact job.

**Interfaces:**
- Fixtures cover passing/failing rendered pages, responsive diagram visibility, alt text/caption, malformed metadata, broken images, and overflow.
- README documents setup, local mirror usage, environment variables, report format, and explicit live-run separation.

- [ ] Add fixture integration tests for passing and failing pages at desktop and mobile viewports.
- [ ] Run fixture tests and confirm failures before runner/adapter integration is complete.
- [ ] Implement fixture server/test harness and document the supported gstack setup command and CI artifact behavior.
- [ ] Run `node --test tools/wiki-browser-qa/test/*.test.mjs` and the local generated Wiki mirror audit; record exact totals.

### Task 6: Final review and verification

**Files:**
- Modify: only files identified by failing verification.

- [ ] Run source-side existing Wiki validation through `scripts/sync-github-wiki.mjs` in its documented validation mode.
- [ ] Run all new Node tests and repository type/lint checks applicable to touched files.
- [ ] Run `npm run wiki:qa` against the local mirror and verify report/exit behavior.
- [ ] Review `git diff` and `git status`; preserve unrelated changes and do not run live Wiki smoke without explicit provider/target approval.

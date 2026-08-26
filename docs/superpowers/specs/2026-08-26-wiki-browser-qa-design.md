# Wiki Browser QA Design

## Goal

Prevent GitHub Wiki regressions that pass Markdown checks but render incorrectly: slug-like titles, visible YAML metadata, broken navigation, missing diagrams, and failed image loads.

## Scope

Add `tools/wiki-browser-qa/` and expose it as `npm run wiki:qa`. The tool audits a published Wiki through a Chromium browser and emits a human-readable summary plus machine-readable JSON. It does not publish, edit, or repair Wiki content.

## Interface

- Default target: `https://github.com/sorensencc-dotcom/toolforge/wiki`
- Override target: `WIKI_QA_BASE_URL`
- Optional page list: `WIKI_QA_PAGES`, comma-separated Wiki slugs
- Optional output: `WIKI_QA_REPORT`, default `artifacts/wiki-qa/report.json`
- Optional concurrency: `WIKI_QA_CONCURRENCY`, bounded and conservative by default
- Optional timeout: `WIKI_QA_TIMEOUT_MS`
- Non-zero exit when any required assertion fails
- No credentials, cookies, or provider calls

## Checks

For every discovered or explicitly selected page:

1. HTTP/navigation succeeds.
2. Rendered document has one meaningful level-one heading.
3. Browser title and visible heading are human-readable, not the URL slug.
4. No frontmatter keys or YAML delimiter is visible in the rendered body.
5. All sidebar and in-scope page links resolve successfully.
6. No console errors or failed image/network requests occur.
7. Every rendered image has non-empty alternative text and a successful natural size.

### Diagram enforcement

`tools/wiki-browser-qa/diagram-policy.json` is the explicit source of truth for pages that require diagrams. Each required page declares one or more accepted evidence selectors or asset patterns. A page passes only when at least one declared diagram is present, visible, loaded, and backed by a published asset. A missing, broken, or non-visible diagram is a hard failure. Diagram evidence must map back to a stable repository source asset or generated artifact. ASCII art and diagrams contained only in fenced code blocks are not valid evidence. Required diagrams must remain visible at supported desktop and mobile viewports without unexpected horizontal overflow. Each diagram must have meaningful alternative text and a nearby caption or explanatory heading; image-only explanation is insufficient.

The initial policy covers architecture, provider setup, WhichLLM/model-selection, governance/lifecycle, and other pages already intended to communicate system structure. Ordinary narrative and research pages are not forced to contain diagrams unless added to the policy.

## Architecture

Keep the tool deliberately small:

- `runner.mjs`: CLI, target/page selection, Chromium lifecycle, navigation, console/network capture, report writing, and exit status.
- `browser-adapter.mjs`: the only boundary to the gstack browser executable; constructs commands, parses responses, detects setup/version failures, and normalizes browser observations.
- `checks.mjs`: pure assertion helpers for headings, metadata, links, images, responsive overflow, and diagram evidence.
- `diagram-policy.json`: versioned page-to-diagram requirements plus source-asset mappings.
- `test/`: unit tests for checks and integration fixtures for representative rendered pages.

Reuse `scripts/sync-github-wiki.mjs` for source-side page rules and image validation rather than creating a second Markdown/discovery implementation. Browser discovery starts from the Wiki index and accepts explicit pages for deterministic targeted runs.

Full crawls deduplicate discovered URLs and use bounded concurrency. Retries are limited to transient navigation/network failures; assertion failures are never retried. The runner writes partial results on timeout or interruption, marks unfinished pages explicitly, and exits non-zero. It must not overwhelm GitHub or hide a partial crawl behind an aggregate pass.

Use a small adapter around the supported gstack browser executable. `runner.mjs` must detect the executable before starting, report the expected setup command and detected version when unavailable, and fail clearly rather than silently falling back to HTTP-only checks. Browser setup must be explicit and documented in the tool README and CI job. The tool must remain usable against a local static mirror for deterministic tests.

## Reporting

The JSON report records target, timestamp, page URL, page slug, check results, console errors, failed requests, diagram evidence, source-asset mapping, viewport results, and aggregate pass/fail counts. Secrets and cookies are excluded. Terminal output groups failures by page and check so a Wiki sync can be corrected without manual screenshot inspection. GitHub chrome/sidebar failures are reported separately from page-content failures.

## Verification

- Unit-test every check, including malformed metadata, duplicate headings, broken images, invalid links, and missing diagram evidence.
- Unit-test browser-adapter command construction, response parsing, setup failures, timeouts, and malformed output; integration-test it with a fake executable and one bounded real-browser smoke run.
- Test policy completeness: every classified architecture/provider page must be listed, and every listed rule must reference an existing source asset or generated artifact.
- Integration-test passing and failing fixture pages.
- Run desktop and mobile viewport assertions for diagram visibility, accessibility, and horizontal overflow.
- Run against a local generated Wiki mirror in CI or local tests.
- Run the live Wiki audit manually or on a scheduled workflow; live checks remain separate from deterministic pre-flight because GitHub availability and markup can vary.
- Add `wiki:qa` documentation and CI artifact upload for failed JSON reports.

## Non-goals

- Automatically modifying Wiki pages.
- Treating a generic screenshot or code block as diagram evidence.
- Replacing existing source Markdown/image validation.
- Running provider smoke tests or using credentials.

## What already exists

- `scripts/sync-github-wiki.mjs` already owns Wiki publication, frontmatter normalization, archive exclusion, sidebar generation, and source Markdown image validation.
- Existing Node test runner and Vitest configurations provide test conventions; the new checks should use the repository's Node test style unless browser integration requires a separate runner.
- GitHub Wiki remains the live rendering target; local generated mirrors remain the deterministic fixture target.

## Not in scope

- A second Markdown parser or publication pipeline; source-side validation stays in the existing sync script.
- Automatic page repair or republishing; the QA tool reports failures only.
- Full visual screenshot-diff baselines; structural rendering and diagram evidence are the first enforcement layer.
- Provider/API smoke tests; Wiki QA uses no credentials or external model calls.

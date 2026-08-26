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

- `runner.mjs`: CLI, environment parsing, exit status, report writing.
- `browser.mjs`: Chromium lifecycle, navigation, console/network capture, page inspection.
- `discovery.mjs`: Wiki page discovery from the Wiki index or explicit page list.
- `checks.mjs`: pure assertion helpers for headings, metadata, links, images, and diagram evidence.
- `diagram-policy.json`: versioned page-to-diagram requirements.
- `diagram-policy.test.json` or equivalent coverage fixture: ensures every required architecture/provider page is represented by policy and prevents silent opt-out.
- `test/`: unit tests for checks and integration fixtures for representative rendered pages.

Use an existing supported browser runner when available; otherwise declare the smallest locked browser dependency needed for reproducible CI. Browser setup must be explicit and documented. The tool must remain usable against a local static mirror for deterministic tests.

## Reporting

The JSON report records target, timestamp, page URL, page slug, check results, console errors, failed requests, diagram evidence, source-asset mapping, viewport results, and aggregate pass/fail counts. Secrets and cookies are excluded. Terminal output groups failures by page and check so a Wiki sync can be corrected without manual screenshot inspection. GitHub chrome/sidebar failures are reported separately from page-content failures.

## Verification

- Unit-test every check, including malformed metadata, duplicate headings, broken images, invalid links, and missing diagram evidence.
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

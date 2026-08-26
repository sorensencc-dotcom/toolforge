# Wiki browser QA

`npm run wiki:qa` audits rendered Wiki pages through the gstack browser adapter. It reports only; it never publishes, edits, repairs, authenticates, or calls a provider.

## Browser setup

Install gstack browse through the local agent-skill distribution. On Windows, point the runner at its executable and confirm both the command surface and server are healthy before an audit:

```powershell
$env:GSTACK_BROWSER_EXECUTABLE = "$env:USERPROFILE\.agents\skills\gstack\browse\dist\browse.exe"
& $env:GSTACK_BROWSER_EXECUTABLE --help
& $env:GSTACK_BROWSER_EXECUTABLE status
```

The second command must exit `0`. If the executable is missing, reinstall or rebuild the gstack browse skill before running QA. The runner fails closed with setup diagnostics; it never falls back to HTTP-only checks.

## Environment

| Variable | Purpose |
| --- | --- |
| `WIKI_QA_BASE_URL` | Wiki root; defaults to the published Toolforge Wiki. |
| `WIKI_QA_PAGES` | Optional comma-separated page slugs for a deterministic targeted audit. |
| `WIKI_QA_REPORT` | JSON report path; defaults to `.artifacts/wiki-qa/report.json`. |
| `WIKI_QA_CONCURRENCY` | Bounded crawl concurrency; default `2`, maximum `4`. |
| `WIKI_QA_TIMEOUT_MS` | Per-page and audit timeout in milliseconds. |
| `GSTACK_BROWSER_EXECUTABLE` | Explicit gstack `browse.exe` or `browse` path. |

## Local mirror and fixtures

Use a local static mirror or the loopback fixture server for deterministic checks. Fixture integration starts its own `127.0.0.1` server; it never opens the live Wiki:

```powershell
$env:WIKI_QA_RUN_FIXTURE_BROWSER = '1'
$env:GSTACK_BROWSER_EXECUTABLE = "$env:USERPROFILE\.agents\skills\gstack\browse\dist\browse.exe"
node --test tools/wiki-browser-qa/test/fixture-integration.test.mjs
```

The fixtures cover a passing rendered page and failures for visible YAML metadata, duplicate/slug headings, a broken image, empty alt text, missing caption, desktop/mobile diagram evidence, and horizontal overflow.

For a local mirror you already host, set the base URL and explicit page list:

```powershell
$env:WIKI_QA_BASE_URL = 'http://127.0.0.1:8080'
$env:WIKI_QA_PAGES = 'Home,toolforge-architecture-overview'
$env:WIKI_QA_REPORT = '.artifacts/wiki-qa/local-report.json'
npm run wiki:qa
```

## Report contract and safety boundary

The report JSON includes `target`, `timestamp`, `pages`, and `aggregate`. Each page records URL, slug, status, named checks, console errors, failed requests, diagram evidence, source mapping, viewports, attempts, and any sanitized error. No credentials, cookies, request headers, or provider output enter reports.

Live audits are separate from deterministic local-mirror checks. Run a published-Wiki audit only after explicit operator approval for the target and network use; this tool neither requires nor accepts credentials. Do not run a live audit as part of unit tests, CI pre-flight, or fixture verification.

## CI integration

No existing workflow is suitable: `toolforge-wave-d.yml` runs database/E2E/load gates and does not provision a local Wiki mirror or gstack browse. No workflow file was changed. Add the following sequence only to a future dedicated Wiki QA job after it provisions gstack browse and starts a local mirror:

```yaml
- name: Run Wiki QA against local mirror
  env:
    GSTACK_BROWSER_EXECUTABLE: ${{ github.workspace }}/.agents/skills/gstack/browse/dist/browse
    WIKI_QA_BASE_URL: http://127.0.0.1:8080
    WIKI_QA_REPORT: ${{ github.workspace }}/wiki-qa-artifacts/report.json
  run: npm run wiki:qa

- name: Upload failed Wiki QA report
  if: failure()
  uses: actions/upload-artifact@v7
  with:
    name: wiki-qa-report-${{ github.run_id }}
    path: wiki-qa-artifacts/report.json
    if-no-files-found: warn
```

Keep source-side Markdown and image validation in `scripts/sync-github-wiki.mjs`; browser QA is the rendered-page layer.

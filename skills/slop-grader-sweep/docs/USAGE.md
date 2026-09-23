# Usage: slop-grader-sweep

## Local setup

```bash
cd skills/slop-grader-sweep
npm ci
npm run build
node scripts/install-hook.mjs
```

`install-hook.mjs` appends a call to `dist/cli.js changed` to
`.git/hooks/pre-commit.ps1`, guarded by the marker comment
`# slop-grader-sweep: installed`. Safe to run more than once — it
no-ops on a second run.

## What runs on commit

Staged `.md` files under `docs/`, `wiki/`, or `**/specs/` are graded
against `no-ai-slop` and `tech-docs`. Findings print to stdout as a
warning summary. The commit always proceeds (exit code 0), even on a
slop-grader failure, timeout (30s), or missing credential.

## What runs on schedule

`.github/workflows/slop-sweep.yml` runs weekly, sweeps every markdown
file under the same three roots repo-wide, and commits
`drift/SLOP-REPORT.md` as `github-actions[bot]` if the report changed.
Requires the `OPENROUTER_API_KEY` repo secret; its absence produces a
`Status: DEGRADED` report rather than a failed workflow run.

## Manual smoke test (run once at build time, not automated)

```bash
cd skills/slop-grader-sweep
npm run build
OPENROUTER_API_KEY=<your key> node dist/cli.js sweep
cat ../../drift/SLOP-REPORT.md
```

Confirms the real `slop-grader` binary, the real OpenRouter call, and
the report-writer all work end to end. This step is not part of CI —
CI only exercises the mocked unit tests.

## Troubleshooting

- **No findings ever appear**: check `OPENROUTER_API_KEY` is set and
  `resolveApiKey('openrouter')` (see `credential-resolver.ts`) resolves
  it — a missing key silently skips grading on both paths by design.
- **Hook doesn't run on commit**: confirm
  `# slop-grader-sweep: installed` appears in
  `.git/hooks/pre-commit.ps1`; re-run `node scripts/install-hook.mjs`
  if not.
- **Sweep report stuck at DEGRADED**: check the `OPENROUTER_API_KEY`
  repo secret is set in GitHub Actions settings, and check the workflow
  run logs for the underlying subprocess error.

# TRM DevOps Triage Operator Usage Guide

This guide provides operational workflows, real-world examples, and troubleshooting steps for triaging issues using `trm-devops-triage`.

## Local CLI boundary

From Toolforge root, provision existing module dependencies and build explicitly:
`npm run build --prefix modules/trm-devops`. Invoke installed local build with
`node modules/trm-devops/dist/cli/index.js status`. Wrapper fixes executable to
current Node and entrypoint to that build; missing build fails without downloads.
Only sync/prune/status accepted; option paths travel as literal argv with
shell:false, not shell text. Import-line SEC-AUDITOR exception covers this exact
boundary. CLI retains existing writes/remote effects; sync/prune require explicit
operator approval and are not part of read-only pilot. Regression tests use
intercepted calls and disposable fake CLI, never production triage actions.
Run `node --test skills/trm-devops-triage/tests/*.test.mjs` from Toolforge root;
boundary tests require existing TypeScript compiler from installed Slop toolchain.

---

## 4-step operator workflow

### Step 1: Inspect and claim

Inspect `dev/triage/queue.md` for active defects. When starting work on a defect:
1. Change `- **Status:** PENDING` to `- **Status:** IN_PROGRESS`.
2. Add your username to `- **Owner:** <username>`.
3. Add initial triage findings inside the `<!-- operator-notes-start -->` block.

### Step 2: Diagnostic execution

Each ingested defect includes concrete diagnostic commands under `#### Action Steps`. Run these commands in your shell:
- Pull runner logs with `gh run view --repo <repo> --log-failed`.
- List recent runs with `gh run list --repo <repo> --limit 5`.
- Validate linting and governance with `npm run lint`.

### Step 3: Resolution & verification

1. Reproduce and fix the issue locally in the target repository.
2. Run test suites to ensure zero regressions: `npm test`.
3. Commit and push the fix or re-run the failed GitHub Actions workflow.

### Step 4: Prune and archive

Once CI confirms green:
1. Update `- **Status:** RESOLVED` in `dev/triage/queue.md`.
2. Execute the prune cycle:
   ```bash
   node modules/trm-devops/dist/cli/index.js prune
   ```
3. The resolved defect is archived to `dev/triage/archive/YYYY-MM/resolved-defects.md`, indexed in `dev/triage/archive/index.json`, and the source note is removed from the NotebookLM operational buffer.

---

## Troubleshooting

### Lock file collision (`queue.md.lock`)
If a previous sync or prune command terminated abnormally and left a lock:
1. Verify no active `trm-devops` processes are running.
2. Remove `dev/triage/.cache/queue.md.lock`.
3. Re-run `node modules/trm-devops/dist/cli/index.js status`.

### Quarantined items (`dev/triage/.cache/quarantine/`)
Items failing extraction validation are stored in `.cache/quarantine/` with diagnostic logs. Inspect raw JSON and correct formatting before explicitly approved `node modules/trm-devops/dist/cli/index.js sync`. Current CLI has no `--retry-quarantine` flag.

---
name: session-wrap-2026-07-16-ci-fixes-4-repos
description: "Root-caused and fixed CI across kb-sync, cic-ingestion, rewrite-mcp, rewrite-docs after a fabricated diagnostic review; 3/4 fully green, rewrite-docs blocked on a private-submodule PAT"
metadata: 
  node_type: memory
  type: project
  originSessionId: 94e5400c-ecb6-4961-9927-b33cf2b5f59a
---

Fixed CI in 4 repos (kb-sync, cic-ingestion, rewrite-mcp, rewrite-docs) after the user pasted a "diagnostic review" whose claims were almost entirely wrong (fabricated commit hash, wrong root causes, a repo claimed missing that was actually just uncloned locally). Verified every claim against real `gh run`/`gh api` output and job logs before touching anything.

**Real root causes found (none matched the pasted review):**
- kb-sync: markdown table in a `script: |` block under-indented, breaking the YAML block scalar (0 jobs ever scheduled). Fixed by building the string via array+join.
- cic-ingestion: unquoted `Gate: PASS` colon broke YAML the same way; separately, `runs-on: ubuntu-20.04` is a retired GitHub-hosted runner image, so 3 other workflows queued 11-20h+ forever. Bumped to `ubuntu-latest`.
- rewrite-mcp: `vite@^8` vs `@vitejs/plugin-react@^4` peer conflict broke `npm ci`. Also found and fixed a second, unrelated self-inflicted bug: BOB's docs-index generator stamped a live timestamp, which the pre-push drift-check hook then flagged every single run, permanently blocking pushes — fixed by stripping the timestamp from the generator (bob/core/pipelines/docsSync.js).
- rewrite-docs: not fabricated — real repo, just not cloned to c:\dev (Explorer's Recent-files .lnk was the only trace). 4 real bugs: gitignored lockfile, CJS `require()` under `"type":"module"`, 3 orphan submodule gitlinks with no `.gitmodules` entries, and CI workflows never checking out submodules at all.

**Key non-obvious lesson:** passing a custom `token:` to `actions/checkout` authenticates the ENTIRE checkout (main repo + all submodules) with that one token. A fine-grained PAT scoped to only one private submodule will break the main repo checkout itself. Fix is to checkout with the default token, then a separate step injecting `git config url.<PAT-url>.insteadOf <plain-url>` scoped to just the private submodule's URL before `git submodule update --init --recursive`.

**Unresolved at session end:** rewrite-docs's `CI`/`CI Pipeline` still red — the `SUBMODULE_PAT` secret itself returns `Authentication failed` against `claude-setup` even after being regenerated once. Workflow config is confirmed correct (verified via the exact same auth pattern working structurally, just rejected by GitHub). User needs to verify the token's Contents:Read permission and repo-access selection actually saved, ideally by testing `git ls-remote https://x-access-token:<PAT>@github.com/sorensencc-dotcom/claude-setup.git` locally to isolate token-vs-Actions-environment.

**Also found, not fixed (flagged only, out of scope):** rewrite-docs's `Governance Validation` workflow runs a PowerShell script that writes to a hardcoded `C:\dev\GOVERNANCE_VALIDATION_REPORT.json` — only works if a Windows runner happens to check out at that exact path, which GitHub-hosted `windows-latest` runners never do.

**Privacy check performed:** before making `claude-setup` (claude-config-backup's real repo) public per an initial user request, scanned it for secrets. Found no live credentials, but did find personal config (account UUID, device name, local project-folder layout) — flagged this, user chose the PAT route instead of going public.

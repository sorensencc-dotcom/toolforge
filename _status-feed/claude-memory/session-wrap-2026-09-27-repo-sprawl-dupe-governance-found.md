---
name: session-wrap-2026-09-27-repo-sprawl-dupe-governance-found
description: "CIC docs governance remediation plan closed (both repos merged); surfaced broader repo-sprawl problem — duplicate CIC-GOVERNANCE checkouts, nested clones of same origin, needs full audit in fresh session"
metadata:
  node_type: memory
  type: project
  originSessionId: 1ec8eb39-3cfc-47df-b8a5-051e4ac8eb5c
  modified: 2026-09-27T19:47:55.105Z
---

## What closed
CIC docs governance remediation SDD plan (`docs/superpowers/plans/2026-09-26-cic-docs-governance-remediation.md`) — both repos merged locally to `main`, nothing pushed:
- Repo A (`C:\dev`): merge commit `2d7d6fd3`, tests 230/231 (1 expected skip), governance validator PASS.
- Repo B (`C:\dev\rewrite-mcp`): merge commit `55f9d6c`, tests green (env-gated skip only), 3/3 link-checks PASS.
Both feature worktrees removed, branches deleted. Full ruling history lived in the SDD ledger inside the now-deleted worktree — gone from disk, recoverable via `git log` on the merge commits if needed.

## What surfaced, unresolved
User asked why "governance" appears twice — investigation found:
1. **Not a real dupe**: `docs/meta/governance/` (Repo A, IJFW/toolforge process rules) vs `docs/cic/` (Repo B, Cast Iron Charlie project docs) are different subject matter that happen to share the word "governance." This is the same CIC-overload the session's glossary fix (`22e5d1c`) already addressed.
2. **Real dupe, confirmed**: `CIC-GOVERNANCE/` (governance *engine* code — scripts/wrappers/tests) exists byte-identical (MD5-matched) in 5 places:
   - `C:\dev` (root — root repo's own origin is `toolforge.git`)
   - `C:\dev\toolforge\` — **a second, nested clone of the same `toolforge.git`** inside the root repo
   - `C:\dev\toolforge-nlm-pack-gate\` — also a `toolforge.git` clone
   - `C:\dev\viking-phase3\` — different origin (`toolforge-marketplace.git`), governance engine copy-pasted in
   - `C:\dev\graft\` — plain subdir, not its own repo, just copied files inside root `C:\dev` tree

   Root repo + 2 nested clones of the *same* remote is pure redundancy (not intentional multi-project reuse like the documented `dev-sandbox/*` pattern). The `viking-phase3` / `graft` copies are genuine cross-repo vendoring with no sync mechanism — drift risk, currently matching by luck not design.

3. Broader pattern, not yet enumerated: same `grep`/`find` sweep that found this was run only for `governance`/`CIC_MASTER`/`CIC_DOCS` terms — the underlying `.worktrees/*`, `dev-sandbox/*`, and multiple `*-wiki` mirror directories under `C:\dev` root suggest this kind of nested-clone / copy-paste sprawl is likely not isolated to governance code. Full scope unknown.

## Why
**Why:** Chris's read after seeing this: "this just gets worse and worse, no wonder sometimes rules are just ignored" — i.e. suspects sprawl/duplication is *why* governance rules don't get consistently applied (stale copies enforcing old rules, or nobody sure which copy is canonical).

**How to apply:** Next session should open with a repo-sprawl audit as its own dedicated task — not folded into unrelated work. Scope: enumerate every nested git clone under `C:\dev`, every duplicated directory tree (checksum-compare, not just name-match), identify canonical source for each, and produce a cleanup plan (dedupe / symlink / submodule / delete) for user review before executing anything. This is recon + plan first — do not delete or consolidate anything without explicit per-item confirmation, given the destructive/hard-to-reverse-action policy.

## Explicitly NOT done this session
No cleanup, no deletion, no consolidation. Investigation only got as far as confirming the `CIC-GOVERNANCE` case as a proof-of-concept of the pattern.

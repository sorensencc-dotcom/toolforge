---
name: session-wrap-2026-09-27-wiki-governance-enforcement-pass
description: "Multi-repo wiki/README/About enforcement pass against wiki-style-and-structure.md — 7 repos closed, resume point for remaining repos"
metadata:
  node_type: memory
  type: project
  originSessionId: 29e0f45a-aec1-4dbb-8727-047f35f6d0a6
  modified: 2026-09-27T07:36:54.129Z
---

CIC/Toolforge doc-governance enforcement pass against `docs/meta/governance/wiki-style-and-structure.md` (W1-W12/R1-R9 rules). User said "we have others to do" — more repos remain beyond the original pass order. This is the resume point.

**Source of truth:** `C:\dev\docs\meta\governance\wiki-style-and-structure.md` (now v1.1 after PR #56), `GOVERNANCE.md`, `documentation-policy.md`. CIC brand: `charlie-deep-research\cic_design_system.md`.

## Repos closed this session

| Repo | Brand | Result |
|---|---|---|
| `C:\dev\toolforge` | `product-toolforge` | Fixed: Home frontmatter, footer identity, 2 `file://` links stripped. Pushed `68f5187` on branch `docs/readme-about-pass-2026-09-26`. Also added `docs/meta/governance/wiki-sync-registry.md` (per-product canonical-side registry, §10 TODO) — committed `96f706c`, merged via PR #53. |
| `C:\dev\charlie-deep-research` | `cic` | Clean, README R-pass already done pre-session, pushed. No action needed. |
| `C:\dev\sigil` | `sigil` (new matrix bucket, PR #56) | Clean, README R-pass already done. |
| `C:\dev\sigil-wiki` | `hybrid` (sigil primary, CIC secondary for diagrams) | Fixed: scaffolded `_Sidebar.md`/`_Footer.md`, frontmatter on 3 pages. Pushed `566934b`. **Caution:** this canonical clone gets overwritten by `sigil/scripts/sync-wiki.mjs` on republish — my hand-added frontmatter got wiped once already mid-session when the sync reran. If frontmatter is missing again, re-add at the authoring source (`C:\dev\sigil\docs\wiki\*.md`), not the clone. |
| `C:\dev\trm` / `C:\dev\trm-wiki` | `cic` | Fixed: frontmatter on 9 wiki pages, footer CIC citation, broken sidebar command (`fleet:wiki:reconcile`→`wiki:publish`) fixed. Pushed `a3a583e`. Flagged W11 (off-palette Mermaid hex in Home.md) — **appears to be getting fixed independently**: `_Footer.md` picked up a `npm run wiki:regen-cic` pointer mid-session, not done by me. Also flagged: ~200 untracked `wiki/entities/` + diagram assets (git-tracking gap, generator-owned, not fixed). |
| `C:\dev\rewrite-docs` | flagged gap → now `rewrite-docs`/`rewrite-labs` (PR #56) | Clean, README R-pass already done. |
| `C:\dev\wiki` (quarantine) | generated dump | Confirmed correctly quarantined (lives inside dirty `C:\dev` root repo, branch `parkd821-20260908` — not touched). Flagged: generated pages mislabeled `status:"active"` instead of `"generated"` — generator-level fix, not done. |
| `sorensencc-dotcom/kb-sync` wiki (cloned fresh to `C:\dev\kb-sync-wiki`) | `internal-obsidian`/`kb-sync` | 1855 top-level pages, only ~27 promoted (linked from `_Sidebar.md`) — rest is exempt generated dump per rule 1. Fixed: frontmatter (`status/owner/last-reviewed/brand`) on Home + all 26 promoted pages. Fixed GitHub About typo ("Knowlege"→correct) + brand wording. Pushed `fa24e4a` (had to rebase once — an automated kb-sync publish bot pushed `5b668dc` mid-session; confirmed no overlap with my 26 files before rebasing). Left ~1800 dump pages untouched (out of scope). |

## PRs merged mid-session (not by me, by user/another agent)

- `toolforge` PR #56 — added `sigil` and `rewrite-docs`/`rewrite-labs` brand-matrix buckets, bumped guideline doc to v1.1. Verified clean.
- `sigil` PR #11 — genericized `C:\dev\sigil-repo` → `<sigil-repo>` in `docs/wiki/README.md` clone snippet. Verified clean, no remaining literal paths.

## Still open / deferred (not blocking, human call needed)

1. ~~**trm W11**~~ — **VERIFIED CLOSED 2026-09-27 (next session).** Fixed by trm `44fa390` (`wiki:regen-cic` → `scripts/regenerate-wiki-diagrams-cic.mjs`). All 6 `classDef` hex in `trm/wiki/Home.md` and `trm-wiki/Home.md` match `cic_design_system.md` exactly; on `origin/main`, clone in sync. Follow-up commits by someone else: `467b1d8` converted curated frontmatter to HTML comments (Gollum renders YAML as text), `d7a32e4` moved CIC detail to footer. Open question: does the HTML-comment frontmatter form satisfy the wiki-style rules, or should the guideline allow it for Gollum wikis?
2. **`C:\dev\wiki` quarantine** — generated pages carry `status:"active"` instead of `"generated"`. Same class of issue found and left in `kb-sync-wiki`'s ~1800 unpromoted dump pages. Both are generator-output, not hand-edit targets — needs someone to patch the frontmatter-stamping script(s), not the output.
3. **kb-sync-wiki** 2 pages use a different frontmatter schema (`historical-revocation-verification.md`, `mobile-websocket-heartbeats.md` — archival accession/box template) — added owner/brand additively, did not normalize the rest of the schema. Confirm that's fine long-term or worth a template unification later.
4. **Sync-clone fragility** — both `sigil-wiki` and `trm-wiki`/`kb-sync-wiki` are canonical clones that get overwritten by their repo's publish script on next run. Any manual frontmatter/content fix to a clone should also land at the authoring source in the parent repo, or it'll get silently dropped on next sync. Worth flagging to Chris as a process gap (validator should maybe diff clone vs authoring source, per `wiki-sync-registry.md` §"How to use this registry" point 2).

## Not yet started (repos still to audit — "we have others to do")

No other repo names given yet this session. Next step: ask Chris which repos are next, or check `wiki-sync-registry.md`'s Registry table (`C:\dev\toolforge\docs\meta\governance\wiki-sync-registry.md`) for any product row not yet covered above.

## Process notes for whoever resumes

- Pattern used all session: validate → propose findings + smallest patch table → wait for explicit OK → implement → **stage files by explicit name, never `git add -A` or `git add wiki/`** (a bare `git add wiki/` in `trm` almost committed 200+ untracked generated files, entities dump included — caught before commit, not after).
- Before pushing to any `*-wiki` clone, `git fetch` + check whether an automated publish bot moved the remote (`kb-sync-wiki` needed a rebase mid-session for exactly this reason) — diff the incoming remote commit against your own file list before rebasing to confirm no real conflict.
- Owner value used throughout: `chris`. Last-reviewed dates stamped with the actual session date, not copy-pasted.

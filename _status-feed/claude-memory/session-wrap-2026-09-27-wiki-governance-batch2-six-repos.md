---
name: session-wrap-2026-09-27-wiki-governance-batch2-six-repos
description: "Second wiki-governance enforcement wave — 6 more repos (cic-ingestion, toolforge-marketplace, icf, helix, rewrite-mcp, cic-jev), 2 new brand-matrix buckets, Gollum frontmatter fix, cross-repo contamination found"
metadata:
  node_type: memory
  type: project
  originSessionId: 41255ef8-8073-4de6-9aef-515ec1c7cd90
  modified: 2026-09-27T11:53:45.220Z
---

Continuation of [[session-wrap-2026-09-27-wiki-governance-enforcement-pass]] (7 repos, closed earlier same day). Chris gave 6 more repos: cic-ingestion, icf, toolforge-marketplace, helix, rewrite-mcp, cic-jev.

**Source of truth:** `C:\dev\toolforge\docs\meta\governance\wiki-style-and-structure.md`, `wiki-sync-registry.md`.

## Governance doc changes (PR #59, toolforge, branch `docs/wiki-repos-batch2-2026-09-27`)

- Confirmed with Chris: GitHub wiki (Gollum) frontmatter should be HTML-comment wrapped, not bare YAML, since Gollum renders raw YAML as visible page text. Added as a documented alternate form (still satisfies W1-W3), used for every fix in this session.
- New brand-matrix bucket `helix` — local chat-engine product (live at `127.0.0.1:8877/`), own chrome, not CIC/product-toolforge.
- `hybrid` bucket gained a worked example: `icf` — Iron Command Forge ops/reporting dashboard (live at `127.0.0.1:8080/dashboard`), primary `icf` + secondary `cic` (verified live: dashboard's `:root` CSS imports Cast Iron Charlie design-system tokens directly, exact forge-palette hex).
- Doc version 1.1 → 1.2. `wiki-sync-registry.md` gained 6 new rows, one per repo below.
- **Process note:** lost my first pass at these doc edits to a concurrent session/agent doing branch checkouts in the same `C:\dev\toolforge` working tree (uncommitted edits vanished when HEAD moved to `docs/strip-kb-sync-sidebar-contamination-2026-09-27`). Redid the work on a fresh branch off `origin/main` and **committed immediately** rather than batching edits — avoid long uncommitted-edit windows in shared repos from now on.

## Repos closed this session

| Repo | Brand | Result |
|---|---|---|
| `cic-ingestion` (435-page fleet dump) | `cic` | Fixed: Home + 17 sidebar-promoted pages (6 new HTML-comment blocks, 11 amended in place). Pushed to `master` directly (no PR flow on wiki clones). 418 non-promoted dump pages untouched — same `status:"active"`-should-be-`"generated"` gap already tracked for trm/kb-sync. |
| `rewrite-mcp` (301-page fleet dump) | `rewrite-docs` | Fixed: Home + 19 promoted pages. Found and fixed 2 real bugs along the way: 3 pages missing `status` entirely (`CIC_MASTER_SPEC`, `GH_ACTIONS_COMPLIANCE_GUIDE`, `MEMORY_INTEGRATION_GUIDE`), 2 pages misusing the `status` key for project-rollout state instead of page lifecycle (`CIC_SKILLOPT_SYSTEM`: `stage-2-integration` → renamed to `rollout-stage`; `SKILLOPT_VALIDATOR_SPEC`: `operational` → renamed to `operational-status`), both then given real `status: active`. Checked all promoted diagrams for CIC-palette contamination (hard-forbidden for `rewrite-docs`) — clean, no forge hex. |
| `toolforge-marketplace` (23 pages) | `product-toolforge` | Fixed: 15 genuine product pages. **Left 6 untouched — real cross-repo contamination**, not this product's content: `trm-research-gaps.md`, `kb-sync-readme.md`, `historical-revocation-verification.md`, `mobile-websocket-heartbeats.md`, `competitor-watchlist-drift-engine.md`, `KB_SYNC_DAG.md`. `historical-revocation-verification.md`/`mobile-websocket-heartbeats.md` are byte-identical in shape to the same-named pages flagged in kb-sync-wiki last session (archival accession template) — confirms the fleet reconciler is cross-pollinating unrelated repos, not a one-off. Chris independently fixed the same class of bug in `toolforge`'s own root `_Sidebar.md` same session (commit `da92a6b`, different repo — his session, not mine). |
| `icf` (5 pages) | `hybrid` (icf primary, cic secondary) | Fixed: all 5 pages. Verified live via `curl 127.0.0.1:8080/dashboard` — CSS `:root` block is the exact CIC forge palette (`--forge:#1a1410`, `--ember:#C4501A`, etc.), confirming secondary brand is real, not assumed. |
| `helix` (2 pages, no chrome) | `helix` (new bucket) | Fixed: both pages, scaffolded `_Sidebar.md`/`_Footer.md` (neither existed — earliest-stage wiki of the batch). |
| `cic-jev` (1 page) | — | **Left untouched** per Chris — page is the unedited GitHub default ("Welcome to the cic-jev wiki!"), not a governance violation until real content lands. |

## Open / flagged, not fixed (human call or generator-level fix needed)

1. **toolforge-marketplace `_Sidebar.md` cross-repo contamination** (6 pages, listed above) — needs the same strip Chris already did on `toolforge`'s own sidebar (`da92a6b`), applied here too. Not done — flagged in registry instead of silently deleting foreign content from a repo I don't own the call on.
2. **Fleet-reconciler root cause** — same contamination pattern now confirmed in 2 different repos' wikis (toolforge, toolforge-marketplace) plus kb-sync-wiki from last session. Whatever in `C:\dev\kb-sync\modules\wiki\fleet-wiki-reconciler.ts` is stamping cross-repo page snapshots needs a real fix, not per-repo cleanup forever.
3. **cic-ingestion / rewrite-mcp generated-dump `status` mislabel** — same open gap as trm/kb-sync-wiki/`C:\dev\wiki`, tracked in registry, generator-owned not hand-fixed.
4. **trm W13 (new rule, added same day by a concurrent session)** — `wiki-style-and-structure.md` gained W13 (CIC diagrams must use parchment/paper fills, not dark forge-black node fills) via commit `26f5bc0`, still on an unmerged branch (`docs/brand-matrix-sigil-rewrite-2026-09-26` lineage) as of this session. trm's Home.md diagram (verified W11-clean last session, dark `#1A1410`/`#2C2420` node fills matching the *background* tokens) may now violate W13's node-fill rule once that branch merges — **not checked this session**, flag for whoever picks up trm next.

## Not yet started

No further repo names given. Same as last time — ask Chris, or check `wiki-sync-registry.md`'s table (now covers 13 products) for gaps.

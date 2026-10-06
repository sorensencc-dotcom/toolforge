# Wiki Sync Registry

**Status:** draft. Target state is a single writer (`npm run docs:sync`). As of 2026-10-06 every row in the JSON is `enabled: false`, so cutover has not happened (see "Single writer")
**Owner:** TODO (docs / platform)  
**Last inventory pass:** 2026-09-27 (ET). Single-writer section verified 2026-10-06
**Companion:** `docs/meta/governance/wiki-style-and-structure.md` §10 (Sync contract)
**Machine-readable source:** [wiki-sync-registry.json](wiki-sync-registry.json). The orchestrator reads only the JSON. This table is human notes and must name the same products.

This file is the per-product answer to §10's "MUST document which side is canonical." Until a row here is marked **active** (not draft) and an owner claims it, treat dual edits as drift and prefer the side named in **Canonical path / remote**.

## Rules (CLI-facing)

- Operators **MUST** treat exactly one side per product as curated SoT for wiki prose + `_Sidebar` / `_Footer` (when those exist).
- Ambiguous dual edits **MUST** be treated as drift. Validate **SHOULD** fail or warn until one side wins.
- `C:\dev\wiki\**` **MUST NOT** be treated as a sync twin of any product wiki. It is a **generated quarantine / dump** (synthesized nodes, research mirrors, non-curated copies). Promotion into a curated wiki is a deliberate copy + page-status change + sidebar link — never an automated twin sync.
- Authors **MUST NOT** invent a second sync script in this registry. Cite only tools that exist on disk; otherwise leave **sync tool / owner** as TODO.
- Fleet tooling under `C:\dev\kb-sync` (`modules/wiki/fleet-wiki-reconciler.ts`) is a legacy writer being turned off (see "Single writer"). Its `scripts/wiki-validate-pre*.sh` hooks stay as validators. Neither overrides the canonical side named below.

## Single writer

Target: one process publishes product wikis, `npm run docs:sync` (`scripts/doc-sync/run.mjs`), driven by [wiki-sync-registry.json](wiki-sync-registry.json). Plan: `docs/superpowers/plans/2026-10-01-unified-doc-sync.md`. Preview one product with `npm run docs:sync -- --product=<name> --dry-run`. A bare `--dry-run` throws `NO_PRODUCTS_SELECTED` while every row is disabled. **`--product=<name>` skips the `enabled` check, so running it without `--dry-run` really publishes to that product's wiki remote.**

**State on 2026-10-06:** the orchestrator and its tests exist. All 7 JSON rows (`toolforge`, `sigil`, `kb-sync`, `trm`, `icf`, `helix`, `toolforge-marketplace`) are `"enabled": false`, so `docs:sync` publishes nothing by default. The legacy writers below are still live on disk. Retirement is plan Task 10, which runs only after the Task 9 preview passes. Do not read this section as "cutover done."

Legacy writers to turn off (plan Task 10):

| Writer | Path | Status |
| --- | --- | --- |
| Toolforge direct publish | `C:\dev\package.json` `wiki:publish` / `wiki:sync` -> `scripts/sync-github-wiki.mjs` | Live. Stays as the `--build-only` build step for the `toolforge` row; the npm aliases get repointed to `docs:sync`. The toolforge pre-push no longer publishes (PR #87). |
| kb-sync direct publish | `C:\dev\kb-sync\package.json` `wiki:publish` / `wiki:sync` -> kb-sync's own `scripts/sync-github-wiki.mjs` | Live. The script stays as the `--build-only` build step for the `kb-sync` row; both aliases get repointed to `docs:sync`. |
| Fleet reconciler | `C:\dev\kb-sync\modules\wiki\fleet-wiki-reconciler.ts`, `fleet:wiki:reconcile` | Live. To be deleted. |
| kb-sync pre-push publish | `C:\dev\kb-sync\scripts\wiki-validate-prepush.sh` (runs `sync-github-wiki.mjs`) | Live. Publish block to be removed; validation stays. |
| kb-sync CI publish | `C:\dev\kb-sync\.github\workflows\wiki-drift-and-publish.yml` | Live. Publish step to be removed. |
| NotebookLM nightly Stage 3 | `C:\dev\kb-sync\scripts\notebooklm\kb-sync-nightly.ps1` | Live. Stage to be deleted. |
| sigil CI publish | `C:\dev\sigil-repo\.github\workflows\wiki-sync.yml` | Live. To be deleted. `npm run wiki:sync` stays as the `--wiki-dir` build step for the `sigil` row. |
| TRM publish | `C:\dev\trm\scripts\sync-remote-wiki.mjs`, `wiki:publish` | Live. Script to be deleted; `wiki:publish` repointed to `docs:sync --product=trm`. |

Until a product's row is enabled, its legacy writer in the "Sync tool / owner" column below is still the real publisher. After cutover, JSON wins and that column is history.


## Registry

| Product | Brand | Canonical path / remote | Mirror path(s) | Sync tool / owner | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| toolforge | `product-toolforge` | **Repo-first authoring SoT:** `C:\dev` root (origin `toolforge.git`) (`Home.md`, root wiki pages, `wiki/**` mappings) → publishes to `git@github.com:sorensencc-dotcom/toolforge.wiki.git` | In-repo: root `Home.md` / `_Sidebar.md` / `_Footer.md`, `wiki/**`, `tools/wiki-browser-qa/wiki-page-rules.mjs` (`ROOT_WIKI_FILES`, `ROOT_WIKI_PAGE_MAPPINGS`). **Not** a twin: `C:\dev\wiki\**` | `npm run wiki:sync` / `wiki:publish` → `scripts/sync-github-wiki.mjs`. QA: `npm run wiki:qa`. Owner: TODO (platform) | 2026-09-26 | No local `toolforge-wiki/` clone found; publish uses a temp clone. Dual trees (`toolforge`, marketplace / nlm-pack-gate forks, root `C:\dev\wiki`) **MUST NOT** all be SoT — only the path this script pushes. |
| sigil | `sigil` (product; not CIC-by-default — CIC diagrams only for explicitly CIC-facing Sigil surfaces) | **Repo-first:** `C:\dev\sigil-repo\docs\wiki\` → `https://github.com/sorensencc-dotcom/sigil.wiki.git` (local clone `C:\dev\sigil-wiki`) | `C:\dev\sigil-wiki` (GitHub wiki clone: `Home.md`, `_Sidebar.md`, `_Footer.md`). In-repo `docs/wiki` uses `README.md` (sync renames to `Home.md`) | `npm run wiki:sync` → `sigil/scripts/sync-wiki.mjs` (from `C:\dev\sigil-repo`). Related: `wiki:audit`, `wiki:verify-diagrams`. Owner: TODO (sigil) | 2026-09-26 | Clone holds full curated chrome; in-repo tree is the authoring subset the sync script copies. |
| trm | `cic` | **Repo-first:** `C:\dev\trm\wiki\` → `https://github.com/sorensencc-dotcom/TRM.wiki.git` (local clone `C:\dev\trm-wiki`) | `C:\dev\trm-wiki` (clone mirror of published wiki). In-repo `wiki/` is authoring SoT per `scripts/sync-remote-wiki.mjs` | `npm run wiki:publish` → `scripts/sync-remote-wiki.mjs`; `npm run wiki:validate` → `scripts/validate-diagram-triplets.mjs`. Owner: TODO (trm) | 2026-09-26 | Script copies `wiki/` over a fresh clone of `TRM.wiki.git` then pushes. Prefer editing `C:\dev\trm\wiki`, not only the clone, unless deliberately clone-first for a one-off. |
| charlie-deep-research | `cic` (design SoT) | **No curated product wiki.** Visual SoT remains `C:\dev\charlie-deep-research\cic_design_system.md` (see wiki-style §3). | `wiki/entities/**` only (entity stubs / synthesized pages) — **not** a curated Home/`_Sidebar` surface | No product wiki sync script found. Fleet entity synthesis may touch `wiki/entities`. Owner: TODO if a Charlie wiki is ever stood up | 2026-09-26 | Do not treat entity stubs as a twin of Toolforge or TRM wikis. |
| rewrite-docs | `rewrite-docs` / `rewrite-labs` (Rewrite Labs product — hard-forbid CIC Industrial chrome) | **No product GitHub wiki / Home/`_Sidebar` found** under `C:\dev\rewrite-docs` | None for wiki sync | None found — TODO owner if a rewrite wiki is published later | 2026-09-26 | Cross-links fine; do not invent a sync path here. |
| cic-ingestion | `cic` | `https://github.com/sorensencc-dotcom/cic-ingestion.wiki.git` (local clone `C:\dev\cic-ingestion-wiki`) | 435 pages total; only 17 promoted via `_Sidebar.md` (Home + `CIC_MASTER_INDEX`, `CIC_DESIGN_SYSTEM_INDEX`, phase/sandbox architecture docs, a handful of adapter/canary pages). Remainder is a per-source-file fleet dump (`*.ts.md`, `status: active` stamped, no owner/brand) | Fleet: `C:\dev\kb-sync\modules\wiki\fleet-wiki-reconciler.ts` publishes; footer stamp reads "Automated Fleet Wiki Sync". Owner: TODO | 2026-09-27 | Same generated-dump `status:"active"` mislabel gap as trm/kb-sync-wiki (should be `"generated"`) — generator-level fix, not hand-fixed here. Frontmatter added to the 17 promoted pages, pushed. |
| toolforge-marketplace | `product-toolforge` | `https://github.com/sorensencc-dotcom/toolforge-marketplace.wiki.git` (local clone `C:\dev\toolforge-marketplace-wiki`) | 23 pages, all effectively curated (small repo) | No sync script found in `C:\dev\toolforge-marketplace`; likely fleet-published same as above. Owner: TODO | 2026-09-27 | **Cross-repo contamination noted:** `_Sidebar.md` links 6 foreign kb-sync/trm pages; tracked in audit log for fleet reconciler cleanup. 15 product pages verified with frontmatter, pushed. |
| icf | `hybrid` (primary `icf`, secondary `cic`) | `https://github.com/sorensencc-dotcom/icf.wiki.git` (local clone `C:\dev\icf-wiki`) | 5 curated pages (`Home`, `Architecture`, `Reporting-Engine`, `Web-Dashboard`, `Operations-Guide`) + `_Sidebar`/`_Footer` | No sync script found in `C:\dev\icf`; live ops dashboard at `http://127.0.0.1:8080/dashboard` imports Cast Iron Charlie CSS tokens directly (`_ds/cast-iron-charlie-design-system-*/colors_and_type.css`) confirming the `cic` secondary. Owner: TODO | 2026-09-27 | Confirmed live: dashboard `:root` CSS vars use exact CIC forge palette hex. Frontmatter added to all 5 pages, pushed. |
| helix | `helix` | `https://github.com/sorensencc-dotcom/helix.wiki.git` (local clone `C:\dev\helix-wiki`) | 2 curated pages (`Home`, `README`) + `_Sidebar.md` / `_Footer.md` | None found. Owner: TODO | 2026-09-27 | Local chat-engine product per Chris; orchestrates ICF/WhichLLM/Sigil as authorities but is its own brand, not CIC or product-toolforge chrome. Live at `http://127.0.0.1:8877/`. Frontmatter + minimal `_Sidebar`/`_Footer` added, pushed. |
| rewrite-mcp | `rewrite-docs` (see rewrite-docs row above — same brand bucket, different repo) | `https://github.com/sorensencc-dotcom/rewrite-mcp.wiki.git` (local clone `C:\dev\rewrite-mcp-wiki`) | 301 pages total; ~19 promoted via `_Sidebar.md`. Remainder is per-source-file fleet dump, same shape as cic-ingestion | Fleet: same reconciler as cic-ingestion (footer stamp "Automated Fleet Wiki Sync"). Owner: TODO | 2026-09-27 | Checked promoted pages for CIC-palette diagram contamination (hard-forbidden for this brand) — **clean**, no forge-hex hits. Heavy textual "CIC" cross-references throughout (allowed as links, not chrome). Same generated-dump `status` mislabel gap as cic-ingestion. Frontmatter added to the 19 promoted pages, pushed. |
| cic-jev | `cic` (per repo name; content not yet written) | `https://github.com/sorensencc-dotcom/cic-jev.wiki.git` (local clone `C:\dev\cic-jev-wiki`) | 1 page (`Home` = unedited GitHub default "Welcome to the cic-jev wiki!") | None — wiki not yet populated | 2026-09-27 | Left as-is per Chris — stub, not a governance violation until real content lands. |
| kb-sync | TODO | TODO (canonical side not checked) | TODO | JSON row only: `buildCommand` runs kb-sync's own `scripts/sync-github-wiki.mjs --build-only`; `preValidate` is `npm run wiki:validate-contract`. Owner: TODO | 2026-10-06 | Row exists in `wiki-sync-registry.json` (`enabled: false`) but had no row here until now. Remote: `https://github.com/sorensencc-dotcom/kb-sync.wiki.git`. |
| *(quarantine)* | `internal-obsidian` / `kb-sync` | **N/A — not canonical for any product** | `C:\dev\wiki\**`, kb-sync `wiki/entities/**`, Obsidian vault wiki mirrors, `_kb-sync-staging` | Fleet: `C:\dev\kb-sync\modules\wiki\fleet-wiki-reconciler.ts`; validate hooks: `C:\dev\kb-sync\scripts\wiki-validate-precommit.sh`, `wiki-validate-prepush.sh`. Owner: kb-sync / fleet (ops), not product wiki SoT | 2026-09-26 | Generated quarantine. Receipts and provenance matter more than brand paint. **MUST NOT** be used as the curated twin of toolforge / sigil / trm. |

## How to use this registry

1. Before editing wiki prose, look up the product row and edit the **Canonical** side (or the authoring path the named sync script reads).
2. After publish, the clone under `*-wiki/` (when present) **SHOULD** match remote `*.wiki.git`. Drift between clone and in-repo authoring tree **SHOULD** be resolved by re-running the named sync tool — not by hand-merging both directions.
3. If you need a new product row, add it here in the same table shape; do not bury canonical-side notes only in a sync script comment.
4. When this document leaves **draft**, flip §10 in `wiki-style-and-structure.md` from "registry TODO" to "registry is authoritative," and fill remaining Owner TODOs.

## Related tooling (cited, not invented)

| Tool | Path | Role |
| --- | --- | --- |
| Doc sync orchestrator | `C:\dev\scripts\doc-sync\run.mjs` (`npm run docs:sync`) | Target single writer to product wikis. Rows disabled until cutover (see "Single writer") |
| Toolforge page map | `C:\dev\tools\wiki-browser-qa\wiki-page-rules.mjs` | `ROOT_WIKI_FILES` / `ROOT_WIKI_PAGE_MAPPINGS` |
| Wiki validate hooks | `C:\dev\kb-sync\scripts\wiki-validate-precommit.sh`, `wiki-validate-prepush.sh` | Pre-commit / pre-push contract checks |

---

*Amendment: keep this table short. Deep style rules stay in `wiki-style-and-structure.md`; this file only answers "which side wins per product."*

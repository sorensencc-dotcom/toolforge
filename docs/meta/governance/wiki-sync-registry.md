# Wiki Sync Registry

**Status:** draft  
**Owner:** TODO (docs / platform)  
**Last inventory pass:** 2026-09-26 (ET)  
**Companion:** `docs/meta/governance/wiki-style-and-structure.md` §10 (Sync contract)

This file is the per-product answer to §10's "MUST document which side is canonical." Until a row here is marked **active** (not draft) and an owner claims it, treat dual edits as drift and prefer the side named in **Canonical path / remote**.

## Rules (CLI-facing)

- Operators **MUST** treat exactly one side per product as curated SoT for wiki prose + `_Sidebar` / `_Footer` (when those exist).
- Ambiguous dual edits **MUST** be treated as drift. Validate **SHOULD** fail or warn until one side wins.
- `C:\dev\wiki\**` **MUST NOT** be treated as a sync twin of any product wiki. It is a **generated quarantine / dump** (synthesized nodes, research mirrors, non-curated copies). Promotion into a curated wiki is a deliberate copy + page-status change + sidebar link — never an automated twin sync.
- Authors **MUST NOT** invent a second sync script in this registry. Cite only tools that exist on disk; otherwise leave **sync tool / owner** as TODO.
- Fleet tooling under `C:\dev\kb-sync` (notably `modules/wiki/fleet-wiki-reconciler.ts` and `scripts/wiki-validate-pre*.sh`) **MAY** publish or validate across repos; it does **not** override a product's canonical side named below.

## Registry

| Product | Brand | Canonical path / remote | Mirror path(s) | Sync tool / owner | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| toolforge | `product-toolforge` | **Repo-first authoring SoT:** `C:\dev\toolforge` root (`Home.md`, root wiki pages, `wiki/**` mappings) → publishes to `git@github.com:sorensencc-dotcom/toolforge.wiki.git` | In-repo: root `Home.md` / `_Sidebar.md` / `_Footer.md`, `wiki/**`, `tools/wiki-browser-qa/wiki-page-rules.mjs` (`ROOT_WIKI_FILES`, `ROOT_WIKI_PAGE_MAPPINGS`). **Not** a twin: `C:\dev\wiki\**` | `npm run wiki:sync` / `wiki:publish` → `scripts/sync-github-wiki.mjs`. QA: `npm run wiki:qa`. Owner: TODO (platform) | 2026-09-26 | No local `toolforge-wiki/` clone found; publish uses a temp clone. Dual trees (`toolforge`, marketplace / nlm-pack-gate forks, root `C:\dev\wiki`) **MUST NOT** all be SoT — only the path this script pushes. |
| sigil | `sigil` (product; not CIC-by-default — CIC diagrams only for explicitly CIC-facing Sigil surfaces) | **Repo-first:** `C:\dev\sigil\docs\wiki\` → `https://github.com/sorensencc-dotcom/sigil.wiki.git` (local clone `C:\dev\sigil-wiki`) | `C:\dev\sigil-wiki` (GitHub wiki clone: `Home.md`, `_Sidebar.md`, `_Footer.md`). In-repo `docs/wiki` uses `README.md` (sync renames to `Home.md`) | `npm run wiki:sync` → `sigil/scripts/sync-wiki.mjs` (from `C:\dev\sigil`). Related: `wiki:audit`, `wiki:verify-diagrams`. Owner: TODO (sigil) | 2026-09-26 | Clone holds full curated chrome; in-repo tree is the authoring subset the sync script copies. |
| trm | `cic` | **Repo-first:** `C:\dev\trm\wiki\` → `https://github.com/sorensencc-dotcom/TRM.wiki.git` (local clone `C:\dev\trm-wiki`) | `C:\dev\trm-wiki` (clone mirror of published wiki). In-repo `wiki/` is authoring SoT per `scripts/sync-remote-wiki.mjs` | `npm run wiki:publish` → `scripts/sync-remote-wiki.mjs`; `npm run wiki:validate` → `scripts/validate-diagram-triplets.mjs`. Owner: TODO (trm) | 2026-09-26 | Script copies `wiki/` over a fresh clone of `TRM.wiki.git` then pushes. Prefer editing `C:\dev\trm\wiki`, not only the clone, unless deliberately clone-first for a one-off. |
| charlie-deep-research | `cic` (design SoT) | **No curated product wiki.** Visual SoT remains `C:\dev\charlie-deep-research\cic_design_system.md` (see wiki-style §3). | `wiki/entities/**` only (entity stubs / synthesized pages) — **not** a curated Home/`_Sidebar` surface | No product wiki sync script found. Fleet entity synthesis may touch `wiki/entities`. Owner: TODO if a Charlie wiki is ever stood up | 2026-09-26 | Do not treat entity stubs as a twin of Toolforge or TRM wikis. |
| rewrite-docs | `rewrite-docs` / `rewrite-labs` (Rewrite Labs product — hard-forbid CIC Industrial chrome) | **No product GitHub wiki / Home/`_Sidebar` found** under `C:\dev\rewrite-docs` | None for wiki sync | None found — TODO owner if a rewrite wiki is published later | 2026-09-26 | Cross-links fine; do not invent a sync path here. |
| *(quarantine)* | `internal-obsidian` / `kb-sync` | **N/A — not canonical for any product** | `C:\dev\wiki\**`, kb-sync `wiki/entities/**`, Obsidian vault wiki mirrors, `_kb-sync-staging` | Fleet: `C:\dev\kb-sync\modules\wiki\fleet-wiki-reconciler.ts`; validate hooks: `C:\dev\kb-sync\scripts\wiki-validate-precommit.sh`, `wiki-validate-prepush.sh`. Owner: kb-sync / fleet (ops), not product wiki SoT | 2026-09-26 | Generated quarantine. Receipts and provenance matter more than brand paint. **MUST NOT** be used as the curated twin of toolforge / sigil / trm. |

## How to use this registry

1. Before editing wiki prose, look up the product row and edit the **Canonical** side (or the authoring path the named sync script reads).
2. After publish, the clone under `*-wiki/` (when present) **SHOULD** match remote `*.wiki.git`. Drift between clone and in-repo authoring tree **SHOULD** be resolved by re-running the named sync tool — not by hand-merging both directions.
3. If you need a new product row, add it here in the same table shape; do not bury canonical-side notes only in a sync script comment.
4. When this document leaves **draft**, flip §10 in `wiki-style-and-structure.md` from "registry TODO" to "registry is authoritative," and fill remaining Owner TODOs.

## Related tooling (cited, not invented)

| Tool | Path | Role |
| --- | --- | --- |
| Toolforge wiki publish | `C:\dev\toolforge\scripts\sync-github-wiki.mjs` | Repo → `toolforge.wiki.git` |
| Toolforge page map | `C:\dev\toolforge\tools\wiki-browser-qa\wiki-page-rules.mjs` | `ROOT_WIKI_FILES` / `ROOT_WIKI_PAGE_MAPPINGS` |
| Sigil wiki sync | `C:\dev\sigil\sigil\scripts\sync-wiki.mjs` | `docs/wiki` → `sigil-wiki` / `.wiki.git` |
| TRM wiki sync | `C:\dev\trm\scripts\sync-remote-wiki.mjs` | `trm/wiki` → `TRM.wiki.git` |
| Fleet wiki reconciler | `C:\dev\kb-sync\modules\wiki\fleet-wiki-reconciler.ts` | Cross-repo fleet publish / report |
| Wiki validate hooks | `C:\dev\kb-sync\scripts\wiki-validate-precommit.sh`, `wiki-validate-prepush.sh` | Pre-commit / pre-push contract checks |

---

*Amendment: keep this table short. Deep style rules stay in `wiki-style-and-structure.md`; this file only answers "which side wins per product."*

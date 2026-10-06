# Wiki Style & Structure Guideline

**Status:** draft (local review)  
**Owner:** Chris Sorensen  
**Last-reviewed:** 2026-09-27  
**Doc version:** 1.2 (bump on any W/R rule-ID change or renumber, or when brand-matrix rows change; other docs may cite these IDs directly)  
**Enforcement:** none yet. No script in `scripts/` implements the W1–W13 / R1–R9 checks below — confirmed 2026-09-26 via `graft grep "validate"` and a scan of `scripts/*validate*`. `sync-github-wiki.mjs` publishes wiki content but does not check frontmatter/status/sidebar/index-collision rules. Treat every rule ID here as spec-only until a wiki-validate script exists and is wired to CI or pre-commit.  
**Audience:** Copywriters, wiki operators, CLI validators, and agents that author or sync curated GitHub wikis / in-repo wiki mirrors.

This is the living rule for how curated wiki surfaces look, nest, and stay syncable. It is conversational on purpose: friendly, accurate, complete sentences — and still CLI-enforceable via MUST / SHOULD language below.

## Table of contents

1. [Scope](#1-scope)
2. [Brand matrix](#2-brand-matrix)
3. [CIC Industrial Design System](#3-cic-industrial-design-system-sot--do-not-fork)
4. [Page status set](#4-page-status-set-wiki-pages-only)
5. [Page skeleton](#5-page-skeleton-every-curated-page)
6. [Home / `_Sidebar` / `_Footer` contract](#6-home--_sidebar--_footer-contract)
7. [Taxonomy](#7-taxonomy)
8. [Diagrams & Mermaid by brand](#8-diagrams--mermaid-by-brand)
9. [Links, orphans, and archive](#9-links-orphans-and-archive)
10. [Sync contract](#10-sync-contract-canonical-clone-vs-in-repo)
11. [`INDEX.md` vs `Index.md` collision](#11-indexmd-vs-indexmd-collision)
12. [README + GitHub About contract (R rules)](#12-readme--github-about-contract-r-rules)
13. [CLI validate vs rewrite (W rules)](#13-cli-validate-vs-rewrite-w-rules)
14. [Voice (Copywriter)](#14-voice-copywriter)
15. [Exemplars](#15-exemplars-follow-these-dont-invent-a-fourth-pattern)
16. [Amendment](#16-amendment)
17. [MkDocs product index (served site)](#17-mkdocs-product-index-served-site)

---

## 1. Scope

### In scope (curated)

- Canonical GitHub wiki clones (example: `trm-wiki/`, `sigil-wiki/`, `*.wiki.git` working trees).
- In-repo wiki mirrors that are intentionally curated and published (example: a hand-kept `wiki/Home.md` that sync scripts promote).

### Out of scope / excluded from curated MUST

- Generated entity dumps and auto-synthesized trees under `C:\dev\wiki`, `entities/`, kb-sync synthesized pages, and similar machine dumps.
- Those trees MAY exist and MAY carry `status: generated`.
- They MUST NOT be held to curated MUST rules unless an operator **promotes** a page into a curated wiki (status changes to `draft` or `active`, owner assigned, linked from Home/_Sidebar).

### Related policies

- Docs/meta naming & placement: `docs/meta/governance/documentation-policy.md`
- Tool lifecycle / tool-manifest statuses: `GOVERNANCE.md` (do **not** overload those statuses onto wiki pages)
- CIC visual SoT: `C:\dev\charlie-deep-research\cic_design_system.md`
- Served MkDocs knowledge base: rewrite-docs. A known product must have an index page, and that index must be re-reviewed when the product repo moves past `last_reviewed` (section 17). This is not a curated-wiki W rule.
- CIC enforcement checklist: `C:\dev\charlie-deep-research\docs\CIC_DESIGN_SYSTEM_ENFORCEMENT.md`

---

## 2. Brand matrix

Every curated wiki surface MUST declare exactly one primary brand (frontmatter `brand:` or an equivalent machine-readable marker on Home). Hybrid surfaces MUST name the primary and the secondary. Every product that ships a curated wiki MUST land in one of the rows below — do not invent a free-text brand that leaves validators with "no matrix bucket."

| Brand id | Typical surfaces | Visual / chrome rules | Nav tone |
| --- | --- | --- | --- |
| `cic` | TRM wiki, Charlie / CIC research wikis, Cast Iron Charlie treatments | CIC Industrial Design System only (see section 3). No Rewrite Labs / Sigil product chrome. | Grave, precise, research-ops |
| `product-toolforge` | Toolforge platform wiki / Home, operator guides, tool index | Product-platform chrome (architecture overview, gateway / runtime / registry language). Do not paste CIC forge palette into product UI chrome unless the page is explicitly CIC-facing. | Operator-grade, deterministic, platform |
| `sigil` | Sigil product wiki (`sigil-wiki` / `sigil/docs/wiki`), connector / relay / MCP operator guides | **Product** chrome by default — not CIC Industrial. Use Sigil product language (envelopes, capabilities, relay, approvals). CIC diagram skins are allowed **only** when the page documents a CIC-facing surface that happens to use Sigil (call that out in the lede or caption); otherwise keep diagrams on the product skin. | Protocol-precise, operator-grade, security-aware |
| `rewrite-docs` / `rewrite-labs` | Rewrite Labs / rewrite-docs / rewrite-mcp product docs and any future Rewrite wiki | Rewrite Labs product chrome only. **MUST NOT** use CIC Industrial palette, typography, or forge chrome. Cross-links to Charlie pages are fine; mixed skins are not. | Product / labs, clear and direct |
| `internal-obsidian` / `kb-sync` | Obsidian vault wiki mirrors, kb-sync operator docs, fleet reconciler notes | Minimal chrome; provenance and sync receipts matter more than brand paint. | Internal ops, provenance-first |
| `icf` | Iron Command Forge wiki (`icf-wiki`), ops dashboard, reporting engine | ICF product chrome (or hybrid CIC secondary). Dashboard chrome imports CIC design system tokens. | Operator-grade, mission-critical ops |
| `helix` | Helix wiki (`helix-wiki`) — local chat-engine product | Own product chrome (session/routing/approval language: ICF, WhichLLM, Sigil as orchestrated authorities). Not CIC Industrial by default. | Operator-grade, session-first |
| `hybrid` | Pages that bridge two brands (e.g. CIC research into Toolforge execution, Sigil product pages that intentionally show CIC-facing diagrams, or ICF's ops dashboard, which is its own product but renders on the Cast Iron Charlie design-system tokens) | Primary brand owns palette and footer; secondary brand MAY be linked, never mixed into the same diagram skin. Name both in frontmatter when the marker supports it (`brand: hybrid` plus primary/secondary notes). Example: `icf` — primary `icf` (Iron Command Forge ops/reporting product), secondary `cic` (dashboard chrome literally imports the CIC design-system CSS tokens). | SHOULD state both audiences in the lede — human/editorial call, not CLI-checkable; no rule ID covers this |

**Hard forbid:** Rewrite Labs / rewrite-mcp / rewrite-docs chrome on Charlie (`cic`) pages; Charlie Industrial chrome on Rewrite Labs (`rewrite-docs` / `rewrite-labs`) or default Sigil (`sigil`) product pages; Sigil-as-CIC by default (Sigil is a product bucket — CIC skins only for explicitly CIC-facing Sigil surfaces). Cross-links are fine; mixed skins are not.

---

## 3. CIC Industrial Design System (SoT — do not fork)

For **CIC-facing** wiki pages, diagrams, Mermaid classDefs, treatment visuals, and exported PNG/HTML diagram skins:

- Source of truth MUST be `C:\dev\charlie-deep-research\cic_design_system.md`.
- Authors MUST follow `docs/CIC_DESIGN_SYSTEM_ENFORCEMENT.md` before publishing.
- Authors MUST NOT invent a second palette table in this guideline, in wiki Homes, or in operator notes. Quote tokens only by reference (“see `cic_design_system.md`”) or copy hex values verbatim from that file when a diagram generator requires literals.
- Typography roles (titles / labels / subtext) MUST match the SoT; do not substitute Inter, Space Grotesk, or other AI-default stacks on CIC surfaces.

### Conflict note (global-operating-rules)

`docs/meta/governance/global-operating-rules-cic-rewrite-labs.md:59` still carries an older default “Cast Iron Charlie” palette (ember `#8B4513`, rust `#A0522D`, brass `#D4AF37`, charcoal `#2C2C2C`, off-white `#F5F3EF`, sage `#9B9B8F` — different hexes than the Industrial SoT).  

**Resolution:** for CIC-facing surfaces (Charlie wikis, TRM diagrams, CIC treatments, CIC wiki Mermaid skins), **`cic_design_system.md` wins**. The global-operating-rules palette remains historical / Rewrite Labs default context until that file is amended. Do not “average” the two palettes.

---

## 4. Page status set (wiki pages only)

Wiki page `status` MUST be one of:

| Status | Meaning |
| --- | --- |
| `draft` | Editable; not yet canonical for operators |
| `active` | Curated and current |
| `deprecated` | Still visible; replacement MUST be linked |
| `archived` | Historical; prefer `archive/` path or clear archived banner |
| `generated` | Machine dump; excluded from curated MUST until promoted |

Do **not** reuse Toolforge tool-manifest statuses (`beta`, `maintenance`, etc.) on wiki pages. Different lifecycle, different CLI checks.

---

## 5. Page skeleton (every curated page)

Every curated wiki markdown page MUST open with YAML frontmatter (or an equivalent HTML meta block for pure HTML diagram pages) that includes at least:

```yaml
---
title: "Human page title"
status: active   # draft | active | deprecated | archived | generated
owner: chris     # github handle or stable operator id
last-reviewed: 2026-09-26
brand: cic       # cic | product-toolforge | sigil | rewrite-docs | internal-obsidian | helix | hybrid
---
```

On GitHub wiki (Gollum) surfaces, raw YAML frontmatter renders as visible page text — Gollum has no frontmatter-stripping step. On those surfaces only, the same key/value block MAY be wrapped in an HTML comment instead of bare YAML fences:

```html
<!--
title: "Human page title"
status: active
owner: chris
last-reviewed: 2026-09-26
brand: cic
-->
```

This satisfies W1–W3 identically; validators MUST parse both forms. Repo-hosted markdown (rendered by GitHub's normal file view, not Gollum) MUST keep bare YAML fences — no visible-text problem there.

SHOULD also include when known: `category`, `replaces`, `replaced-by`, `canonical-path`.

Body skeleton SHOULD be:

1. `# Title` (matches `title:` unless the wiki renderer injects it)
2. One-paragraph lede (what this page is for)
3. Optional architecture / diagram block
4. Sections with stable headings (link targets)
5. “See also” / related links
6. No secrets, no live credentials, no private paths that are not already public contract

**Worked example** (shape only — trim to your page):

```yaml
---
title: "TRM Ingest Pipeline"
status: active
owner: chris
last-reviewed: 2026-09-26
brand: cic
---

# TRM Ingest Pipeline

One-paragraph lede: what feeds this pipeline, what it produces.

## Architecture

<diagram or link to rendered PNG + Mermaid source>

## Operations

...

## See also

- [[Home]]
- [[TRM Harvester]]
```

---

## 6. Home / `_Sidebar` / `_Footer` contract

Every curated GitHub wiki (canonical clone) MUST provide:

| File | Role | MUST |
| --- | --- | --- |
| `Home.md` | Landing page; product promise + primary nav | Exists; names brand; links core sections; hosts or points to primary architecture visual |
| `_Sidebar.md` | Persistent nav | Exists; includes `[[Home]]`; groups links by taxonomy; no dead entries |
| `_Footer.md` | Persistent footer | Exists; one-line product identity; CIC surfaces MUST cite `cic_design_system.md` (link or local path) |

In-repo mirrors SHOULD keep the same trio when the sync path publishes them. If a product uses root `Home.md` as the published wiki Home (Toolforge pattern), that file MUST still satisfy the Home contract.

**Exemplars**

- Structure: `trm-wiki/` (Home + `_Sidebar` + `_Footer` + topic pages + diagram pairs)
- Visual SoT: `charlie-deep-research/cic_design_system.md` (+ enforcement checklist)
- Product nav tone: `Home.md` (this repo's own Toolforge platform Home — repo-relative, not a separate disk location)

---

## 7. Taxonomy

Curated wikis SHOULD use a small, stable taxonomy rather than a flat dump:

1. **Home** — promise, architecture glance, start here
2. **Architecture & core** — data model, security, invariants
3. **Operations / CLI** — commands, runbooks, deployment
4. **Integrations / governance** — closed loops, sync, approvals
5. **Reference** — indexes, changelogs, deep links
6. **Archive** — deprecated / historical only

`_Sidebar.md` MUST mirror that taxonomy. Home SHOULD deep-link the same groups so sidebar and Home cannot drift silently.

Generated entity pages MUST NOT flood curated sidebar groups. Promote selectively.

---

## 8. Diagrams & Mermaid by brand

### CIC (`brand: cic`)

- Raster/SVG diagram skins MUST follow `cic_design_system.md` (palette, type, no shadows / gradients / rounded corners), including the **wiki diagram readability** rules in that SoT.
- **Wiki diagram readability (MUST):** CIC-facing wiki diagrams (HTML / SVG / PNG / Mermaid embeds on curated wiki pages) MUST use a **light parchment / paper field** for the diagram board and for default **node fills**. Approved paper tokens live in `cic_design_system.md` (wiki-diagram mode): parchment board + off-white / cream node fills (for example `#F2ECE2` / `#FAF6F0`).
- **Ink and chrome only:** forge black (`#1A1410`) and near-black companions (`#2C2420`, and similar) are for **ink, borders, labels, and chrome only** — NEVER as node fills or as the wiki diagram board/background.
- **Accents:** brass (`#B8922A`) strokes/outlines and ember (`#C4501A`) for accent stages, emphasis nodes, and dashed feedback loops only — not as the default node fill.
- **Forbid dark-on-dark:** MUST NOT ship forge-filled / near-black nodes with dark text, or a near-black board with low-contrast labels, on CIC wiki diagrams. That failure mode (dark forge node fills on GitHub wiki) is a publish blocker.
- **Visual exemplar:** Chris's parchment/cream board reference (light/off-white node fills, black ink, ember/orange only on accent stages and dashed feedback) is the visual exemplar for CIC wiki diagrams. A coded twin that already follows the paper/ink/ember pattern is `C:\dev\sigil-repo\docs\wiki\architecture.html` (`--color-paper: #f2ece2`, `--color-ink: #2c2420`, `--color-accent: #c4501a`) — use it as a layout/contrast reference even when the page brand is `sigil`; CIC pages still pull hexes from `cic_design_system.md` wiki-diagram mode.
- Mermaid `classDef` fills/strokes/text colors, when used for CIC wiki pages, MUST use SoT **wiki-diagram** tokens only (copy from SoT; do not invent). Default `classDef` fills MUST be parchment/paper — not `#1A1410` / `#2C2420`.
- Prefer: rendered PNG (or HTML→PNG) as the visible artifact, with Mermaid source under a `<details>` block for editing — matching `trm-wiki` / `sigil-wiki` practice.
- Alt text MUST describe the diagram; captions SHOULD name the design system and note parchment readability when relevant.
- Industrial forge-black canvases remain valid for **non-wiki** CIC artifacts called out in the SoT (for example dark master-sheet / preview UIs). They MUST NOT be copied onto curated wiki diagram skins.

### Product Toolforge (`brand: product-toolforge`)

- Use the platform architecture visual language (gateway → runtime → registry → infra).
- Mermaid MAY use neutral product colors; MUST NOT silently adopt CIC forge tokens unless the page is hybrid with CIC primary.

### Internal / kb-sync

- Diagrams SHOULD stay sparse; prioritize sync receipts, provenance, and operator steps over brand paint.

### Sigil (`brand: sigil`)

- Default to product diagram language (relay, connector, envelope, capability boundary) — not CIC Industrial.
- CIC SoT tokens / forge skin are allowed only on pages that document CIC-facing surfaces using Sigil; say so in the caption or lede. Otherwise MUST NOT silently adopt CIC forge tokens.
- Prefer the same PNG + Mermaid-under-`<details>` pattern as other curated wikis when diagrams ship.

### Rewrite Labs (`brand: rewrite-docs` / `rewrite-labs`)

- Product / labs diagram chrome only. MUST NOT use CIC Industrial palette, type, or forge chrome.
- Mermaid MAY use neutral Rewrite Labs product colors.

### Hybrid

- One diagram, one skin. If both brands appear on one page, use separate figures — never a mixed palette in a single Mermaid graph.

---

## 9. Links, orphans, and archive

- Curated pages MUST be reachable from `Home.md` or `_Sidebar.md` (or both).
- Broken relative links MUST fail validate (see W7).
- Orphan curated pages (`status` in `draft|active|deprecated` with zero inbound wiki links from Home/Sidebar/Index) MUST fail validate (see W8).
- `generated` orphans are allowed inside dump trees.
- Deprecated pages MUST link forward to the replacement.
- Archived content SHOULD live under `archive/` (wiki-local) or carry `status: archived` plus an archived banner; do not delete history to “clean” the sidebar — remove sidebar entries instead.

---

## 10. Sync contract (canonical clone vs in-repo)

| Role | Path pattern | Rule |
| --- | --- | --- |
| Canonical GitHub wiki | `*-wiki/` clone of `*.wiki.git` (e.g. `trm-wiki`) | SoT for curated wiki prose + sidebar/footer. Edits land here (or via the published sync path that treats this as SoT). |
| In-repo mirror | `repo/wiki/**`, root `Home.md` mappings | MAY be the authoring SoT when `sync-github-wiki.mjs` (or sibling) publishes from repo → wiki. The sync script’s mapping table is authoritative for that product. |
| Generated dump | `C:\dev\wiki/**`, `entities/**`, synthesized kb-sync wiki nodes | Not curated SoT. Promotion is a deliberate copy + status change + sidebar link. |

Operators MUST document, per product, which side is canonical (clone-first vs repo-first). Ambiguous dual edits MUST be treated as drift: validate SHOULD fail or warn until one side wins.

**Registry:** per-product canonical side lives in [`wiki-sync-registry.md`](wiki-sync-registry.md) (status: draft). Until that registry leaves draft and an owner claims each row, treat this section's "MUST document" as pointed at that file — dual edits remain drift.

Dual Toolforge trees (`C:\dev\toolforge`, marketplace / nlm-pack-gate forks, root `C:\dev\wiki`) MUST NOT all be treated as SoT at once — pick the publishing path the sync script actually pushes.

---

## 11. `INDEX.md` vs `Index.md` collision

Windows filesystems are case-insensitive; GitHub wiki URLs are case-sensitive in spirit and painful when both casings exist across clones.

- A curated wiki MUST ship **at most one** index page casing **within its own working tree** (the wiki clone or the in-repo mirror dir that gets published as the wiki). This rule does not reach across trees: a repo root `INDEX.md` (source-code/tool index, not a wiki page) and that same repo's wiki `Index.md` are different trees and MAY coexist.
- Preferred curated name: `Index.md` (Title case) **or** `INDEX.md` (SCREAMING) — pick one per brand and stick to it, within the wiki tree.
- Toolforge product nav historically uses tool `INDEX.md` in repo roots (not a wiki page); wiki mirrors often use `Index.md`. Operators MUST NOT sync both casings into the same wiki working tree or the same publish staging dir.
- Validate MUST fail if both `INDEX.md` and `Index.md` resolve as distinct paths in a case-sensitive check within one wiki working tree, or appear together in a publish staging dir (see R7 / W rules).

---

## 12. README + GitHub About contract (R rules)

These apply to the **GitHub repository** that owns or publishes the wiki (not every wiki page).

| ID | Rule | Validate | Rewrite | Added |
| --- | --- | --- | --- | --- |
| R1 | README H1 MUST name the product consistently with wiki Home | yes | no (human) | 2026-09-26 |
| R2 | README MUST include a one-paragraph purpose in the first screenful | yes | no (human) | 2026-09-26 |
| R3 | When a curated wiki exists, README SHOULD link to wiki Home | yes | MAY insert stub link | 2026-09-26 |
| R4 | GitHub About description MUST be present, ≤ 350 chars, no emoji spam | yes | MAY set from README lede with approval | 2026-09-26 |
| R5 | About website URL SHOULD be set when a public site/docs URL exists | yes | MAY set known URL | 2026-09-26 |
| R6 | Topics/tags SHOULD be brand-consistent (no CIC topics on pure RewriteLabs repos and vice versa) | yes | MAY suggest; no silent topic wipe | 2026-09-26 |
| R7 | Repo/wiki publish tree MUST NOT contain dual `INDEX.md` + `Index.md` | yes | no (human pick) | 2026-09-26 |
| R8 | README MUST NOT claim the wrong brand chrome (Charlie vs Rewrite Labs vs Toolforge vs Sigil product) | yes | no (human) | 2026-09-26 |
| R9 | About description MUST NOT contradict the README lede | yes | MAY propose About text | 2026-09-26 |

CLI tools MAY validate R1–R9; they MUST NOT rewrite R1/R2/R7/R8 without an explicit human-approved rewrite mode.

---

## 13. CLI validate vs rewrite (W rules)

Wiki working-tree rules for curated surfaces. `validate` = non-zero exit on violation. `rewrite` = auto-fix allowed only when the right-hand column says yes.

| ID | Rule | Validate | Rewrite | Added |
| --- | --- | --- | --- | --- |
| W1 | Frontmatter `status` present and in `draft\|active\|deprecated\|archived\|generated` | yes | MAY insert `status: draft` only | 2026-09-26 |
| W2 | Frontmatter `owner` present on curated (`draft\|active\|deprecated`) pages | yes | no | 2026-09-26 |
| W3 | Frontmatter `last-reviewed` present and ISO date-parseable on curated pages | yes | MAY stamp today’s date only with `--rewrite-dates` | 2026-09-26 |
| W4 | `Home.md` exists at wiki root | yes | no | 2026-09-26 |
| W5 | `_Sidebar.md` exists and includes a Home link | yes | MAY scaffold minimal sidebar | 2026-09-26 |
| W6 | `_Footer.md` exists; CIC footers cite design-system SoT | yes | MAY scaffold footer stub | 2026-09-26 |
| W7 | No broken relative markdown / wiki links among curated pages | yes | no (fix links intentionally) | 2026-09-26 |
| W8 | No orphan curated pages (unlinked from Home/Sidebar/Index) | yes | no | 2026-09-26 |
| W9 | `archived` / deprecated handling: banner or `archive/` path; sidebar does not present archived as current | yes | MAY move file to `archive/` with `--rewrite-archive` | 2026-09-26 |
| W10 | Brand chrome isolation: no Rewrite Labs chrome on `cic` pages; no CIC Industrial chrome on `rewrite-docs` / `rewrite-labs` or default `sigil` product pages; `sigil` MUST NOT be treated as CIC-by-default | yes | no | 2026-09-26 |
| W11 | Mermaid/diagram tokens for `cic` pages match `cic_design_system.md` including wiki-diagram parchment mode (no invented hex) | yes | no (regenerate via Charlie generators) | 2026-09-27 |
| W12 | `generated` pages are excluded from W2–W9 MUST unless promoted; promotion requires status+owner+sidebar link | yes | no | 2026-09-26 |
| W13 | CIC wiki diagrams use parchment/paper node+board fills; forge black for ink/borders/chrome only; brass/ember accents; forbid dark-on-dark / near-black node fills (see §8 CIC + `cic_design_system.md` wiki-diagram mode) | yes | no (regenerate via Charlie generators) | 2026-09-27 |

**Enforcement status:** none of W1–W13 have a validator script yet (confirmed 2026-09-27, see Status block above). All IDs are spec-only.

Generated dumps under `C:\dev\wiki` and `entities/` MUST be skipped by curated validators unless `--include-generated` is set (report-only).

---

## 14. Voice (Copywriter)

- Conversational but precise: complete sentences, active voice, specific control names.
- Prefer operator truth over marketing haze.
- No emoji as structural markers in curated CIC pages (sidebar emoji drift is a SHOULD-fix).
- Provenance blocks for third-party tools follow `documentation-policy.md`.

---

## 15. Exemplars (follow these, don’t invent a fourth pattern)

| Need | Exemplar |
| --- | --- |
| Wiki structure (Home / Sidebar / Footer / topics / diagram pairs) | `C:\dev\trm-wiki\` (external repo — absolute path correct) |
| Visual SoT + enforcement | `C:\dev\charlie-deep-research\cic_design_system.md` and `docs\CIC_DESIGN_SYSTEM_ENFORCEMENT.md` (external repo) |
| CIC wiki diagram readability (parchment board, light nodes, ink + ember accents) | Visual exemplar: Chris's parchment/cream board reference (light/off-white fills, black ink, ember only on accent/feedback). Coded twin: `C:\dev\sigil-repo\docs\wiki\architecture.html` paper/ink/ember CSS vars — contrast pattern only; CIC hex SoT remains `cic_design_system.md` wiki-diagram mode |
| Product platform Home / nav tone | `Home.md` (this repo, Toolforge — repo-relative) |
| CIC research Home tone | `C:\dev\trm-wiki\Home.md` (external repo) |
| Sigil product Home / nav tone | `C:\dev\sigil-repo\docs\wiki\README.md` (canonical) / `C:\dev\sigil-wiki\Home.md` (published twin) — brand `sigil`, not CIC-by-default |

---

## 16. Amendment

Changes to this guideline SHOULD stay local until Chris reviews, except when Chris explicitly authorizes a docs-branch commit/PR (this 1.2 parchment-readability pass is so authorized). No `gh` repo About edits are authorized by this draft alone. After approval, hook validators to W1–W13 / R1–R9 and amend `global-operating-rules` palette text (`docs/meta/governance/global-operating-rules-cic-rewrite-labs.md:59`) if Tier 1 wants the conflict retired at the source.

**Location conformance:** this file lives under `docs/meta/governance/`, satisfying the roadmap/spec placement rule in the root `CLAUDE.md` governance section (specs and roadmaps confined to `docs/meta/` or named project roots). No action needed; noted for future movers of this file.

Bump **Doc version** (top of file) whenever a W/R rule ID is added, removed, or renumbered, or whenever brand-matrix rows / brand ids change — other docs and any future validator script may cite these IDs directly, and a silent renumber breaks those references.


## 17. MkDocs product index (served site)

Curated wikis are not the site people read for the cross-product knowledge base. That site is the rewrite-docs MkDocs build at `https://github.com/sorensencc-dotcom/rewrite-docs`. Do not cite a GitHub Pages URL for it. Pages is not set up there.

A known product with no index page on that site is a failed build, and that index has to be re-reviewed when the product repo moves past `last_reviewed`. The list `docs/meta/required-product-indexes.yml` in rewrite-docs names each product, its index path, its GitHub repo, and `last_reviewed` (YYYY-MM-DD). `scripts/check_required_product_indexes.py` is an MkDocs hook, so `mkdocs build --strict` fails when any listed page is missing on disk or missing from `mkdocs.yml` nav. It also fails when the default branch of that repo has a commit after the end of the `last_reviewed` day in America/New_York. Bumping the date is the attestation. The script does not judge whether the page prose was actually rewritten. The rewrite-docs docs workflow runs that same script.

**Status:** `docs/meta/required-product-indexes.yml` and `scripts/check_required_product_indexes.py` are not on rewrite-docs `origin/main` yet. They are waiting to merge from the rewrite-docs `docs/trm-product-writeup` branch.

Stub index pages name the product, link the verified GitHub repo, and point at the local writeup tree. They do not inline the product markdown tree.

This check is separate from W1-W13. Those wiki rules are still spec-only until a wiki validator exists. Toolforge `.github/workflows/documentation.yml` builds this repo's own MkDocs site. It is not the rewrite-docs product-index gate.

The list is the source of truth. As of 2026-09-29 it covers Helix, Iron Ledger, Sigil, Iron Command Forge (ICF), Topic Research Module (TRM), Toolforge, Toolforge Marketplace, the CIC Deep Research Toolkit (Cast Iron Charlie / charlie-deep-research), and rewrite-mcp. Adding a product means adding the list row (including `repo` and `last_reviewed`), the stub page, and the nav entry in the same change.

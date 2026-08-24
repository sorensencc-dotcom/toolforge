---
ijfw_version: 1.3.2
ijfw_schema: 1
type: software
primary_type: software
secondary_types: []
confidence: 0.907
detected_at: 2026-07-24T05:04:20.927Z
signals:
  - kind: manifest
    weight: 0.9
    manifests: [package.json, package.json, package.json, package.json, package.json, package.json]
  - kind: dir_design
    weight: 0.4
    name: assets
  - kind: dir_design
    weight: 0.4
    name: design
  - kind: file_extension_ratio
    weight: 0.7
    domain: software
    ratio: 0.997
    count: 954
---
---
ijfw_version: 1.3.2
ijfw_schema: 1
type: software
primary_type: software
secondary_types: []
confidence: 0.907
detected_at: 2026-07-24T05:04:20.927Z
signals:
  - kind: manifest
    weight: 0.9
    manifests: [package.json, package.json, package.json, package.json, package.json, package.json]
  - kind: dir_design
    weight: 0.4
    name: assets
  - kind: dir_design
    weight: 0.4
    name: design
  - kind: file_extension_ratio
    weight: 0.7
    domain: software
    ratio: 0.997
    count: 954
---
---
ijfw_version: 1.3.2
ijfw_schema: 1
type: software
primary_type: software
secondary_types: []
confidence: 0.907
detected_at: 2026-07-24T05:04:20.927Z
signals:
  - kind: manifest
    weight: 0.9
    manifests: [package.json, package.json, package.json, package.json, package.json, package.json]
  - kind: dir_design
    weight: 0.4
    name: assets
  - kind: dir_design
    weight: 0.4
    name: design
  - kind: file_extension_ratio
    weight: 0.7
    domain: software
    ratio: 0.997
    count: 954
---
# AGENTS.md

This file follows the open AGENTS.md spec (https://agents.md/) and is the
canonical agent-instructions surface for this project. Platform-specific
files (CLAUDE.md, GEMINI.md, WAYLAND.md, codex/AGENTS.md, .cursorrules,
.windsurfrules, copilot-instructions.md) are thin adapters that point here.

Five IJFW-managed regions live in this file. Content outside the markers is
yours -- IJFW will never touch it.

| Region | Purpose |
|---|---|
| MEMORY | Project memory recalled from `.ijfw/memory/` |
| ROUTING | Platform skill-routing rules |
| AGENTS | Registered agent roster |
| BLACKBOARD | Multi-CLI orchestration scratchpad (Pillar B) |
| DISCIPLINE | Per-domain discipline rules (code \| narrative \| business \| design \| research) |

<!-- IJFW-MEMORY-START -->
Project memory at .ijfw/memory/. Call `ijfw_memory_prelude` for full context.

Last handoff: Handoff: 2026-08-14
====================
<!-- IJFW-MEMORY-END -->

<!-- IJFW-ROUTING-START -->
<!-- IJFW-ROUTING-END -->

<!-- IJFW-AGENTS-START -->
No project agents yet. Run `ijfw team` to set them up.
<!-- IJFW-AGENTS-END -->

<!-- IJFW-BLACKBOARD-START -->
<!-- Reserved for Pillar B multi-CLI orchestration. Empty in alpha. -->
<!-- IJFW-BLACKBOARD-END -->

<!-- IJFW-DISCIPLINE-START -->
<!-- TOOLFORGE-WRITING-DISCIPLINE-START -->
## Technical Writing Heuristics & Style Discipline

All documentation, architecture specs, pull request descriptions, and agent outputs must strictly follow the deterministic writing heuristics defined in `skills/writing-heuristics/SKILL.md`:
1. **Ban conversational throat-clearing** (`Certainly!`, `Sure thing`, `In this section`).
2. **Eliminate filler adverbs & AI slop** (`essentially`, `basically`, `game-changing`, `delve`, `seamlessly`).
3. **Avoid first-person plural** (`we recommend`, `we will`, `let's`).
4. **Use direct imperative or second-person** (`you`), never third-person (`the developer should`).
5. **Enforce active voice** over passive constructions (`is handled by`).
6. **Ground assertions with metrics**; avoid ungrounded qualitative hype (`vastly superior`, `blazing fast`).
7. **State condition before action** ("To X, run Y").
8. **Enforce Sentence case in headings** (preserve acronyms and code spans).
9. **Use descriptive link anchor text**, never generic labels (`here`, `link`).
10. **Include serial Oxford commas** in lists.
11. **Use sequential numbering** for ordered steps.
12. **Mandatory Cathryn Lavery diagram-design standard**: All architecture diagrams, flowcharts, and wiki visual specifications MUST strictly follow Cathryn Lavery's `diagram-design` standard (`https://github.com/cathrynlavery/diagram-design`). Each diagram must be created as a standalone HTML+SVG file (`<name>.html`) using the canonical warm palette (`#f2ece2` paper, `#2c2420` ink, `#5c5349` muted, `#c4501a` terracotta accent, `Playfair Display` serif title, `Barlow Condensed` sans, `Geist Mono` badges), rendered to a PNG asset (`<name>.png`), embedded in markdown as `![Title](<name>.png)`, and enclose raw Mermaid source inside `<details><summary>Mermaid source...</summary></details>`.

Local exemptions must use audit-trail directives: `<!-- heuristics-disable <rule> author="..." reason="..." until="YYYY-MM-DD" -->`.
<!-- TOOLFORGE-WRITING-DISCIPLINE-END -->
<!-- IJFW-DISCIPLINE-END -->

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

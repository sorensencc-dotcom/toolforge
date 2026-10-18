---
name: repo-docs-diagram-sync
description: On-demand deterministic diagram engine and documentation synthesizer enforcing Cathryn Lavery visual design specs and Google Developer Style heuristics.
---

# Repo docs diagram sync

This skill synchronizes technical documentation, architecture specs, and diagram assets across local repositories and remote wiki destinations.

## Core Capabilities

1. **Deterministic Diagram Engine (`diagram-engine.mjs`)**
   - Scans Markdown files for raw Mermaid blocks (` ```mermaid ... ``` `) and outdated HTML diagram skins.
   - Converts Mermaid code into standalone HTML and SVG visual assets adhering strictly to Cathryn Lavery design specifications.
   - Invokes headless Chrome to render matching high-resolution `<name>.png` assets with standard palette variables (`#f5f5f5` paper, `#2d3142` ink, `#4f5d75` muted, and `#bf4520` burnt-tangerine accent).
   - Embeds rendered PNG image references directly above collapsible `<details><summary>Mermaid source...</summary></details>` source blocks.

2. **Documentation Synthesizer (`docs-synthesizer.mjs`)**
   - Audits repository documentation (`README.md`, specs, and wiki pages) against Google Developer Style and `writing-heuristics` discipline.
   - Enforces active voice, condition before action, sentence case headings, and serial Oxford commas.
   - Reconciles local `wiki/` pages with upstream `<repo>.wiki.git` mirrors.

3. **Automation Triggers**
   - Dispatched via CLI (`toolforge sync-docs` or `pwsh scripts/sync-docs-and-diagrams.ps1`).
   - Guarded by Git pre-push hook and CI gates checking asset parity.

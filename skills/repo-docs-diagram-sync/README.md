# Repo docs and diagram sync

On-demand deterministic diagram engine and documentation synthesizer enforcing Cathryn Lavery visual design specs and Google Developer Style heuristics.

## Quick start

To scan diagrams and audit documentation in dry-run mode:

```powershell
pwsh scripts/sync-docs-and-diagrams.ps1 -DryRun
```

To regenerate all diagrams with headless Chrome and stage wiki pages:

```powershell
pwsh scripts/sync-docs-and-diagrams.ps1 -Fix
```

To run via the Toolforge CLI:

```powershell
pwsh skills/toolforge-cli/src/cli.ps1 sync-docs --force
```

## Features

- **Cathryn Lavery visual specs**. Converts Mermaid blocks to HTML+SVG using `#f5f5f5` paper, `#2d3142` ink, `#4f5d75` muted, and `#bf4520` burnt-tangerine accent.
- **Headless Chrome rendering**. Automatically exports matching `<name>.png` assets from standalone HTML sources.
- **Markdown embedding**. Injects rendered PNG previews above collapsible `<details>` blocks containing raw Mermaid code.
- **Google Developer Style auditing**. Enforces active voice, condition before action, sentence case headings, and Oxford commas.
- **Pre-push verification**. Git hook blocks pushes if diagram PNG assets are missing or older than their HTML specs.

For standard inputs, outputs, error taxonomy, and testing contracts, refer to the [Skill Operator Guide](docs/meta/skill-operator-guide.md).

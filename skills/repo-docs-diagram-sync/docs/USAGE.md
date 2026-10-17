# Repo docs diagram sync usage guide

## Overview

The `repo-docs-diagram-sync` skill automates the extraction, generation, rendering, and verification of architecture diagrams and technical documentation. It guarantees visual parity with Cathryn Lavery design standards and enforces deterministic writing heuristics.

## CLI workflows

### 1. Dry run verification

To audit all diagrams and documentation across the repository without modifying files on disk:

```powershell
pwsh scripts/sync-docs-and-diagrams.ps1 -DryRun
```

Or invoke via Toolforge CLI:

```powershell
toolforge sync-docs --dry-run
```

### 2. Full synchronization and PNG rendering

To scan markdown documentation, generate standalone HTML specs, render PNG assets via headless Chrome, and embed image links:

```powershell
pwsh scripts/sync-docs-and-diagrams.ps1 -RenderPng -Fix
```

Or target a specific subdirectory:

```powershell
node scripts/diagram-sync.mjs --fix --path=docs/meta
```

### 3. Verify visual parity

To verify that every Cathryn Lavery HTML diagram has a matching, up-to-date PNG asset committed in git:

```bash
node scripts/diagram-sync.mjs --verify-parity
```

### 4. Audit technical writing heuristics

To audit documentation against writing heuristics (sentence case headings, active voice, Oxford commas):

```bash
node scripts/docs-synthesizer.mjs --audit
```

## Integration with git hooks

The pre-push hook in `.githooks/pre-push` runs `--verify-parity` before any push. When uncommitted or missing diagram PNG assets are detected, the push is halted with an actionable error.

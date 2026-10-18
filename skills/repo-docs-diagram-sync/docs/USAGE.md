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

To verify that every Cathryn Lavery HTML diagram has a matching PNG asset committed in git, and that both files still match the hashes recorded in `.diagram-manifest.json`:

```bash
node scripts/diagram-sync.mjs --verify-parity
```

The gate checks, for each HTML and PNG pair:

- The PNG exists and is committed in git HEAD.
- The manifest has an entry for the PNG. There is no timestamp fallback, so a new pair fails until it is recorded.
- The manifest `htmlHash` matches the HTML (`STALE_PNG` if the spec changed after the render).
- The manifest `pngHash` matches the PNG (`CORRUPT_PNG` if the image changed since it was recorded).

Any error inside the check, such as an unreadable file or an invalid manifest, fails the gate. It never passes silently.

### 3a. Record hashes after a render

After you render or re-render a diagram, record the new hashes:

```bash
node scripts/diagram-sync.mjs --update-manifest            # whole repo
node scripts/diagram-sync.mjs --update-manifest --dry-run  # show what would change
node scripts/diagram-sync.mjs --update-manifest --path=docs/meta
```

`--update-manifest` only reads the PNG files. It never renders or rewrites them. It refuses a file that does not start with the PNG signature, and it prunes entries whose PNG no longer exists. Review the manifest diff before you commit it: the hashes record whatever PNG is on disk, so check that the PNG is the render you intend.

### 4. Audit technical writing heuristics

To audit documentation against writing heuristics (sentence case headings, active voice, Oxford commas):

```bash
node scripts/docs-synthesizer.mjs --audit
```

## Integration with git hooks

The pre-push hook in `.githooks/pre-push` runs `--verify-parity` before any push. When uncommitted or missing diagram PNG assets are detected, the push is halted with an actionable error.

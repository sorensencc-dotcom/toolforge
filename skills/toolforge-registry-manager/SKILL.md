---
skill_name: toolforge-registry-manager
version: 0.1.0
name: Toolforge Registry Manager
category: pipeline
description: Manages Toolforge plugin registry with append-only semantics
author: soren
tags: ["registry", "toolforge", "marketplace"]
---
# Toolforge Registry Manager

Manages the Toolforge plugin registry (`docs/toolforge/registry.json`) with
append-only semantics — no manual edits, tool-only mutations, audit log per
change (`docs/toolforge/registry-audit.log`).

## Metadata

- **ID:** toolforge-registry-manager
- **Version:** 0.1.0
- **Category:** pipeline
- **Runtime:** powershell
- **Entrypoint:** src/registry.ps1

## Usage

```powershell
pwsh src/registry.ps1 -Action add -PluginId <id> -Path <path> -Checksum <sha256>
pwsh src/registry.ps1 -Action get -PluginId <id>
pwsh src/registry.ps1 -Action list [-Category <name>]
pwsh src/registry.ps1 -Action quarantine -PluginId <id> -Reason <text>
```

Checksums are computed via the sibling `src/checksum.ps1` script.

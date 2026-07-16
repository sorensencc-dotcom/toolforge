---
skill_name: toolforge-cli
version: 0.1.0
name: Toolforge CLI
category: utility
description: CLI for Toolforge Marketplace - list, install, submit plugins
author: soren
tags: ["cli", "toolforge", "marketplace"]
---
# Toolforge CLI

Command-line entry point for the Toolforge Marketplace (list/install/submit).

## Metadata

- **ID:** toolforge-cli
- **Version:** 0.1.0
- **Category:** utility
- **Runtime:** powershell
- **Entrypoint:** src/cli.ps1

## Usage

```powershell
pwsh src/cli.ps1 -Command list [-Category <name>] [-Status <name>] [-Format table|json]
pwsh src/cli.ps1 -Command install -Id <plugin-id>
pwsh src/cli.ps1 -Command submit -Path <skill-path> [-DryRun]
```

Delegates registry reads/writes to `toolforge-registry-manager` and
submission checks to `toolforge-submission-validator` (declared as internal
dependencies in `SKILL.json`).

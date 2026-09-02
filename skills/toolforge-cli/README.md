# Toolforge CLI

CLI for the Toolforge Marketplace: list, install, submit plugins.

## Quick Start

```powershell
pwsh src/cli.ps1 -Command list -Category governance -Format json
pwsh src/cli.ps1 -Command install -Id my-plugin
pwsh src/cli.ps1 -Command submit -Path ./skills/my-plugin -DryRun
```

## What it does

- **list:** Browse registry with filters by category, status, version
- **install:** Deploy a plugin from the registry
- **submit:** Validate skill and submit for conformance review
- Delegates to registry-manager and submission-validator
- Supports dry-run preview and multiple output formats

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

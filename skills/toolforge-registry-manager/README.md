# Toolforge Registry Manager

Manages the Toolforge plugin registry with append-only semantics and audit logging.

## Quick Start

```powershell
pwsh src/registry.ps1 -Action add -PluginId my-plugin -Path ./skills/my-plugin -Checksum abc123
pwsh src/registry.ps1 -Action list -Category governance
pwsh src/registry.ps1 -Action get -PluginId my-plugin
```

## What it does

- **add:** Appends plugin entry to registry.json with checksum and audit log
- **get:** Returns single plugin entry from registry
- **list:** Returns all entries, optionally filtered by category
- **quarantine:** Marks entry quarantined with reason (audit-logged)
- Sole writer of `docs/toolforge/registry.json` (no manual edits)

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

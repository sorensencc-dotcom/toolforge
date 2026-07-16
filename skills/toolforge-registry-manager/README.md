# Toolforge Registry Manager

Manages the Toolforge plugin registry with append-only semantics.

## Purpose

Sole writer of `docs/toolforge/registry.json`. Per the Toolforge Marketplace
governance model (`CLAUDE.md` / `docs/meta/TOOLFORGE-MARKETPLACE-SPEC-v1.0.md`):
Tier 1 approves submissions, Tier 2 runs the validator, Tier 3 (this skill,
via CI) publishes the registry after approval. No manual edits to the
registry file — mutations go through this skill so every change is
audit-logged.

## Usage

```powershell
pwsh skills/toolforge-registry-manager/src/registry.ps1 -Action add -PluginId my-plugin -Path skills/my-plugin -Checksum <sha256>
pwsh skills/toolforge-registry-manager/src/registry.ps1 -Action get -PluginId my-plugin
pwsh skills/toolforge-registry-manager/src/registry.ps1 -Action list -Category governance
pwsh skills/toolforge-registry-manager/src/registry.ps1 -Action quarantine -PluginId my-plugin -Reason "failed conformance re-check"
```

## Inputs

- `-Action` (string, required): `add` | `get` | `list` | `quarantine`
- `-PluginId` (string): required for `add`, `get`, `quarantine`
- `-Path`, `-Checksum` (string): required for `add`
- `-Category` (string): optional filter for `list`
- `-Reason` (string): required for `quarantine`

## Outputs

- `add`: appends a registry entry, writes an audit-log line, returns the entry
- `get`: returns the matching registry entry or an error if not found
- `list`: returns all entries, optionally filtered by category
- `quarantine`: marks an entry quarantined with a reason, audit-logged

## Permissions

- `file.read`: read `docs/toolforge/registry.json`
- `file.write`: write registry + `docs/toolforge/registry-audit.log`

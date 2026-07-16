# Toolforge CLI

CLI for the Toolforge Marketplace: list, install, submit plugins.

## Purpose

Single entry point operators/agents use to browse the plugin registry, install
a plugin, or submit a new one for conformance validation — instead of calling
`toolforge-registry-manager` and `toolforge-submission-validator` directly.

## Usage

```powershell
pwsh skills/toolforge-cli/src/cli.ps1 -Command list -Category governance -Format json
pwsh skills/toolforge-cli/src/cli.ps1 -Command install -Id <plugin-id>
pwsh skills/toolforge-cli/src/cli.ps1 -Command submit -Path <skill-path> -DryRun
```

## Inputs

- `-Command` (string, required): `list` | `install` | `submit`
- `-Id` (string): plugin id, required for `install`
- `-Path` (string): skill directory, required for `submit`
- `-Version`, `-Category`, `-Status`, `-Format`: filters/output for `list`
- `-Force`, `-DryRun`, `-Help`: switches

## Outputs

- `list`: table or JSON of matching registry entries (registry read via
  `toolforge-registry-manager`)
- `install`: install result for the given plugin id
- `submit`: delegates to `toolforge-submission-validator` and returns its
  ConformanceReport

## Permissions

- `file.read`: read the registry (`docs/toolforge/registry.json`)
- `file.write`: write install/submission artifacts
- `network`: reserved for future remote registry support (unused in v0.1.0)

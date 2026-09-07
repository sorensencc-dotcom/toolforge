# Toolforge CLI - Usage Guide

CLI entry point for Toolforge Marketplace operations: list, install, and submit.

**Version**: 0.1.0
**Runtime**: PowerShell 5.1+
**Status**: active
**Category**: utility
**Entrypoint**: src/cli.ps1

---

## Purpose

This skill is the operator-facing shell around the marketplace. It reads the Toolforge registry for list and filter views, delegates install and checksum work to toolforge-registry-manager, and delegates submit validation to toolforge-submission-validator when available.

Submit creates a local submission record under the user toolforge submissions folder and leaves Tier 1 caveman review as the next step.

---

## When to use

- Browse marketplace registry entries
- Install a published plugin into the user toolforge skills folder
- Validate and stage a skill submission before caveman review
- Dry-run install or submit to preview without writing

Use toolforge-registry-manager directly for low-level add, quarantine, publish, and checksum. Use toolforge-submission-validator directly when you only want the JSON conformance report.

---

## Prerequisites

- PowerShell (pwsh preferred)
- Registry file at docs/toolforge/registry.json under the C drive dev tree
- Sibling skills toolforge-registry-manager and toolforge-submission-validator present
- For full submit validation: package manager on PATH and validator packages ready

---

## How to run

Entry script: skills/toolforge-cli/src/cli.ps1

Invoke with -Command list, install, or submit.

Examples (from skill or absolute path):

- Command list
- Command list, Category governance, Format json
- Command install, Id toolforge-drift-monitor
- Command install, Id toolforge-drift-monitor, Force, DryRun
- Command submit, Path pointing at a skill folder, DryRun
- Help switch for usage text

### Command reference

- list: optional Category, Status, Format (table default, or json)
- install: required Id; optional Version, Force, DryRun
- submit: required Path; optional DryRun

---

## Inputs and outputs

### list

Filters registry.plugins in memory. Table view shows ID, Name, Version, Category, Status, Published. JSON mode emits the filtered plugin array.

### install

- Looks up the plugin via registry-manager get action
- Refuses quarantined or non-published status
- Copies from manifest_path into HOME/.toolforge/skills/<id> (excludes node_modules, .git, tests, lockfiles)
- Verifies install checksum via checksum.ps1; deletes the install dir on mismatch
- DryRun prints the target path and skips copy
- Force overwrites an existing install directory

### submit

- Requires SKILL.json under Path
- Runs the submission-validator validate script when possible
- Prints conformance checks and recommendation (approve / hold / reject)
- Without DryRun, writes a pending_approval record under HOME/.toolforge/submissions/
- Always reminds: next step is Tier 1 / caveman review

---

## Examples

1. List governance plugins as JSON: invoke cli.ps1 with Command list, Category governance, Format json.
2. Dry-run install: Command install, Id toolforge-drift-monitor, DryRun.
3. Submit with validation only: Command submit, Path to workspace-storage-cleaner, DryRun.

---

## Troubleshooting

**Registry not found**

Confirm docs/toolforge/registry.json exists. List fails hard without it.

**Plugin not found or not published**

Install only works for submission_status published. Use list or registry-manager get to inspect state.

**Checksum mismatch on install**

Install directory is removed. Re-add or publish with a fresh checksum from checksum.ps1, or fix source drift under manifest_path.

**Validator not available on submit**

CLI falls back to simplified checks and holds for caveman review. Prepare toolforge-submission-validator packages and ensure the package manager is on PATH.

**Already installed**

Pass Force to overwrite the existing user skills install directory.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- SKILL.md / README.md / SKILL.json in the skill root
- Related: toolforge-registry-manager, toolforge-submission-validator, toolforge-drift-monitor

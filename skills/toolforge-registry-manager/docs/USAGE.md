# Toolforge Registry Manager - Usage Guide

Sole writer of the Toolforge plugin registry with append-only semantics and an audit log for mutations.

**Version**: 0.1.0
**Runtime**: PowerShell 5.1+
**Status**: active
**Category**: pipeline
**Entrypoint**: src/registry.ps1
**Helper**: src/checksum.ps1

---

## Purpose

This skill owns docs/toolforge/registry.json. Do not hand-edit that file. All adds, publishes, quarantines, and metadata recounts go through registry.ps1 so registry-audit.log stays consistent.

checksum.ps1 hashes a skill payload the same way install does: recursive files, excluding .git, node_modules, tests, lockfiles, and .env files; relative paths; SHA256 by default.

---

## When to use

- Register a new plugin entry (pending) after packaging a skill
- Look up one plugin or list published plugins
- Quarantine a bad entry with a reason
- Publish a pending entry to public marketplace visibility
- Refresh metadata counts after manual recovery
- Compute a checksum before add

Operators usually go through toolforge-cli for list/install/submit. Use this skill when you need the low-level registry mutations.

---

## Prerequisites

- PowerShell
- Writable docs/toolforge/registry.json and docs/toolforge/registry-audit.log under the C drive dev tree
- For add: PluginId, Path (manifest / skill folder), Checksum (from checksum.ps1)

---

## How to run

Entry: skills/toolforge-registry-manager/src/registry.ps1

Actions supported by the script switch:

- add (requires PluginId, Path, Checksum)
- get (requires PluginId)
- list (optional Category filter; returns published only)
- quarantine (requires PluginId, Reason)
- publish (requires PluginId)
- update-metadata (recounts totals)

Checksum helper: skills/toolforge-registry-manager/src/checksum.ps1 with Path and optional Algorithm (default SHA256).

Example flow:

1. Run checksum.ps1 against the skill folder; capture the sha256-... output.
2. Run registry.ps1 Action add with PluginId, Path, Checksum.
3. After review, Action publish with PluginId.
4. If compromised, Action quarantine with Reason.

---

## Inputs and outputs

### Registry paths

- Registry: docs/toolforge/registry.json
- Audit log: docs/toolforge/registry-audit.log (lines: timestamp | OPERATION | pluginId | STATUS | details)

### add entry shape

New plugin objects include: id, manifest_path, checksum, submission_status pending, published_date null, installed_count 0, marketplace_visibility private, added_date, last_updated.

Duplicate id fails with audit ADD FAILED.

### list

Returns JSON array of plugins where submission_status is published. Optional Category filter matches .category when present.

### quarantine / publish

- quarantine sets submission_status quarantined
- publish sets published + marketplace_visibility public + published_date; refuses if quarantined

### checksum output

String form: sha256-<hex> (algorithm prefix lowercased)

---

## Examples

Add then publish:

1. checksum.ps1 -Path <skill-folder>
2. registry.ps1 -Action add -PluginId my-plugin -Path <skill-folder> -Checksum <value>
3. registry.ps1 -Action get -PluginId my-plugin
4. registry.ps1 -Action publish -PluginId my-plugin

List published governance plugins:

registry.ps1 -Action list -Category governance

Quarantine:

registry.ps1 -Action quarantine -PluginId my-plugin -Reason "checksum drift after review"

---

## Troubleshooting

**Plugin already exists on add**

Ids are unique. Quarantine or use a new id; there is no in-place overwrite helper.

**Plugin not found on get / publish / quarantine**

Confirm id spelling via list or by reading registry.json through this tool only.

**Cannot publish quarantined plugin**

Clear the quarantine policy with a human decision first; the script blocks publish while quarantined.

**Checksum mismatch later at install**

Recompute with checksum.ps1 on the same tree install will copy. Remember excluded dirs/files must match.

**Audit log missing**

First mutation creates or appends registry-audit.log beside the registry. Ensure the docs/toolforge directory is writable.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- SKILL.md / README.md / SKILL.json
- Related: toolforge-cli, toolforge-submission-validator

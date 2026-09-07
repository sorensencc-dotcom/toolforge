# Writing Heuristics - Usage Guide

Deterministic technical writing heuristics, anti-slop rules, and Google Developer Style enforcement for Toolforge and global LLM surfaces.

**Version**: 1.0.0
**Runtime**: TypeScript / Node
**Status**: active
**Category**: validation
**CLI**: bin/lint-heuristics.js
**Rules catalog**: heuristics.json and docs/rules.md

---

## Purpose

Lint and optionally autofix markdown prose with 11 canonical rules covering anti-slop and Google style. High-confidence autofixes exist for throat-clearing and heading sentence case. Output formatters: stylish (default), json, sarif.

A PowerShell helper (bin/sync-global.ps1) manages NTFS junctions into global skill surfaces (~/.gemini/config/skills, ~/.agents/skills, ~/.claude/skills).

---

## When to use

- Before merging docs, architecture specs, or PR descriptions
- As a repo check on a docs/ tree
- To preview safe autofixes
- To sync the skill into global agent skill directories on Windows

Not a general grammar checker. It only enforces the catalogued heuristic patterns.

---

## Prerequisites

- Node.js
- From the skill root: install packages; build with the package build script when working from src (bin/lint-heuristics.js is the shipped CLI bundle)
- For sync-global.ps1: Windows with permission to create junctions under the home skill paths

---

## How to run

### Lint (check)

Invoke bin/lint-heuristics.js with subcommand check and one or more files or directories. Directories recurse for .md files.

Useful flags:

- --stdin: read markdown from stdin
- --strict: treat warnings as failures
- --format=stylish|json|sarif

Exit codes: 0 clean; 1 errors (or warnings in strict); 2 no files matched when globs were given.

### Fix

Subcommand fix with optional --dry-run. Applies safe autofixes only. --stdin prints fixed content to stdout.

### Help / version

- --help / -h
- --version / -v (prints 1.0.0)

### Global sync

bin/sync-global.ps1 options:

- default: create/repair junctions to this skill
- -Verify: check junctions point at this source
- -Uninstall: remove managed junctions
- -Silent: quieter verify/install output

---

## Rule catalog (11)

Errors (often autofixable where noted):

- ban-throat-clearing (autofix)
- heading-sentence-case (autofix)
- descriptive-links

Warnings (manual rewrite; some advisory):

- ban-filler-adverbs
- avoid-first-person-plural
- use-second-person (advisory)
- active-voice
- assertion-density
- condition-before-action
- serial-comma (advisory)
- ordered-sequences (advisory)

Full patterns, pass/fail examples, and rationale live in docs/rules.md and heuristics.json.

### Suppression

```markdown
<!-- heuristics-disable rule-id author="username" reason="Rationale" until="YYYY-MM-DD" -->
Exempted text here
<!-- heuristics-enable rule-id -->
```

---

## Inputs and outputs

### Inputs

- Markdown files/directories or stdin text
- Flags: strict, dry-run, format

### Outputs

- stylish: human-readable findings on stdout/stderr
- json / sarif: machine-readable reports
- fix: rewritten files (or dry-run counts)

---

## Examples

Check a docs tree from repo root using the skill bin path.

Fix with preview: fix --dry-run on the same tree.

Pipe a fragment: echo markdown | lint-heuristics check --stdin --format=json

Verify global junctions: sync-global.ps1 -Verify

---

## Troubleshooting

**No markdown files found**

Path did not exist or directory had no .md files. Exit code 2.

**Warnings only but CI failed**

Strict mode was on. Drop --strict or fix warnings.

**Autofix did nothing**

Only high-confidence rules autofix. Filler adverbs, voice, and most style warnings need manual edits.

**Junction NOT MANAGED / MISSING**

Run sync-global.ps1 without -Verify to create junctions. Source must contain skill.json.

**Working from src instead of bin**

Use the package build (tsup) so dist/ matches; operators should prefer the bundled bin/lint-heuristics.js.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- docs/rules.md (detailed rule manual already in this skill)
- SKILL.md / README.md / skill.json
- Related: skill-doc-validator / governance doc checks

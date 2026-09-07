# Toolforge Submission Validator - Usage Guide

Validates skill submissions against the marketplace conformance gate before caveman review / Tier 1 approval.

**Version**: 0.1.0
**Runtime**: Node.js 18+
**Status**: active
**Category**: governance
**Entrypoint**: src/validate.ts (CLI bootstrap: src/cli.js)

---

## Purpose

Given a skill directory path, the validator loads SKILL.json and runs structural checks:

- Manifest validity (required fields, id pattern, semver, status enum)
- Tests presence (tests/test/__tests__ plus package test script)
- Docs completeness (README or docs/README with Purpose/Overview and Usage/Installation sections; Permissions optional but scored)
- Governance alignment (scope-function id naming, owner set, no eval/exec/Function in src JS/TS)
- caveman_review always reported as pending

It returns a ConformanceReport JSON with blockers and a recommendation: approve, hold, or reject.

---

## When to use

- Before toolforge-cli submit (or when CLI delegates to this skill)
- Local preflight before asking for Tier 1 review
- CI / conformance gates on skill packs

This does not run the skill's test suite; tests_pass is structural (directory + test script present implies true, missing implies null).

---

## Prerequisites

- Node.js 18+
- From the skill root: install packages so ts-node is available (cli.js registers ts-node then loads validate.ts)
- Target skill folder with SKILL.json

---

## How to run

Package script (preferred):

- Working directory: skills/toolforge-submission-validator
- Command: run the validate script with the absolute or relative skill path as the argument

Direct:

- node src/cli.js <skill-path>

Exit code: 1 when recommendation is reject; otherwise 0 (including hold and approve).

Library:

- validateSubmission(skillPath) from validate.ts returns the report object

---

## Inputs and outputs

### Input

- skillPath: string path to the skill directory (required)

### ConformanceReport fields

- submission_id: sub-<timestamp>
- skill_id / skill_version: from manifest when parseable
- timestamp: ISO string
- checks.manifest_valid: boolean
- checks.tests_pass: boolean or null
- checks.docs_complete: boolean
- checks.governance_aligned: boolean
- checks.caveman_review: always pending here
- blockers: string array
- recommendation: approve | hold | reject

### Recommendation logic

- reject if manifest_valid is false
- approve if no blockers and tests_pass is not false
- otherwise hold

### What docs_complete looks for

Main doc must exist (README.md or docs/README.md). At least two of these section patterns:

- Purpose or Overview heading
- Usage or Installation heading
- Permissions or Required Permissions heading

### What governance_aligned looks for

- id matches ^[a-z0-9]+-[a-z0-9-]+$
- owner non-empty
- src/*.ts and src/*.js must not match eval(, exec(, or Function(

---

## Examples

Validate a sibling skill:

1. cd to toolforge-submission-validator
2. Ensure packages are installed
3. Run the validate script with path ../workspace-storage-cleaner
4. Read JSON stdout; non-zero exit only on reject

Approve-ready example traits:

- Valid SKILL.json with semver and active status
- tests/ present with files and package.json scripts.test
- README with Overview and Usage sections
- Clean src without eval/exec patterns

---

## Troubleshooting

**Usage: validate <skill-path>**

You omitted the path argument. Pass the skill directory.

**SKILL.json not found / Invalid JSON**

manifest_valid false and recommendation reject. Fix the manifest first.

**Documentation incomplete blocker**

Add README.md with at least two required section headings (Purpose/Overview, Usage/Installation, Permissions).

**Governance check failed**

Id must be scope-function kebab-case with at least one hyphen. Set owner. Remove eval/exec/Function usage from src.

**tests_pass is null**

No tests directory or no package test script. That is not an automatic reject; recommendation can still be approve if other blockers are clear.

**ts-node / loader issues**

Use src/cli.js (not validate.ts as the node entry). The JS bootstrap exists because Node type-stripping can bypass the ts-node CJS hook when .ts is the main entry.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- SKILL.md / README.md / SKILL.json
- Related: toolforge-cli, toolforge-registry-manager

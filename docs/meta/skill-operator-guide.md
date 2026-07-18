# Skill Operator Guide

**Canonical reference for all skill documentation.** Every skill's README.md and SKILL.md must link to this guide instead of duplicating standard sections.

## Skill Documentation Structure

Each skill has three files with distinct purposes:

| File | Purpose | Length | Audience |
| --- | --- | --- | --- |
| **README.md** | Public face. Unique pitch + quick-start. | 50–100 lines | End users discovering the skill |
| **SKILL.md** | Metadata + execution spec. Triggers, input/output schema, runtime. | 100–150 lines | Executor systems (Cowork, CLI, Toolforge) |
| **docs/USAGE.md** | Deep workflow. Examples, integration patterns, troubleshooting. | 150–250 lines | Power users implementing complex flows |

## README.md Template

Keep it terse. Point to this guide for boilerplate.

```markdown
# [Skill Name]

[One-sentence unique pitch]

## Quick Start

[Copy-paste trigger or minimal invocation example]

## What it does

[2–3 bullets on outcomes, not process]

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md#[section-anchor]).

[If deep workflow needed:] See [docs/USAGE.md](docs/USAGE.md) for examples.
```

## SKILL.md Template

Frontmatter + minimal description. Everything else links to this guide.

```markdown
---
name: [id]
description: [1–2 sentences on what operator will achieve]
compatibility: |
  - Runtime: [Node.js 18+, Python 3.10+, bash]
  - Dependencies: [list]
---

# [Skill Name]

[Copy of README.md "What it does" section]

## Trigger

[Exact prompt that invokes this skill]

## Input Schema

[Minimal JSON/TS types, 10–15 lines max]

## Output Schema

[Minimal JSON/TS types, 10–15 lines max]

---

**Full reference:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
```

## Standard Sections (Not Repeated Per Skill)

### Setup & Installation

**For all Node.js skills:**

```bash
npm install
npm test
```

**For all Python skills:**

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
pytest
```

**For all bash skills:**

```bash
chmod +x src/*.sh
./tests/run.sh
```

### Requirements

Always state at top of README.md:

- Runtime (Node.js 18+, Python 3.10+, bash 4.0+)
- System dependencies (curl, jq, sqlite3, etc.)
- Permissions (read:repo, write:artifacts, etc.)
- External services (database, API key, etc.)
- Disk space / timeout if notable

### Inputs & Outputs

**Schema only.** No narrative prose.

Each skill publishes:

```typescript
interface SkillInput {
  [required field]: Type;
  [optional field]?: Type;
}

interface SkillOutput {
  status: "success" | "error";
  [result field]: Type;
  timestamp: string;
}
```

No more than 20 lines per schema.

### Configuration

If skill reads from `configs/`, `env`, or `.yaml` files, list them here with one example:

```yaml
# configs/[service].yaml
setting_one: value
setting_two: 123
```

Override via CLI: `{ setting_one: "override" }` in input.

### Error Handling

Canonical error table. Copy as-is, customize codes only:

| Code | Message | Handler | Escalation |
| --- | --- | --- | --- |
| `CONFIG_MISSING` | Configuration file not found | Log + fail | Check CLAUDE.md for path |
| `PERMISSION_DENIED` | Insufficient permissions | Log + fail | Operator permission audit |
| `TIMEOUT` | Execution exceeded budget | Retry once | Increase timeout in manifest |
| `VALIDATION_FAILED` | Input did not match schema | Log details + fail | Check input types |

### Testing

All skills must have:

- Unit tests (80%+ coverage minimum)
- One integration test (real data, not mocked)
- Test command: `npm test` / `pytest` / `./tests/run.sh`

One line per file:

```text
tests/unit.test.ts — Mocks & schema validation
tests/integration.test.ts — Real [data source]
```

### Troubleshooting

**Only for USAGE.md.** Not README.md or SKILL.md.

Example structure:

```markdown
## Troubleshooting

**Artifact not updating?**
- Check that sync completed (look for `_integration/report.json`)
- Verify Cowork artifact ID matches config
- Regenerate with fresh run

**Search not working?**
- Refresh the artifact in UI
- Verify data exists (sync must have found issues)
- Try searching on a known field
```

## Compliance Checklist

Before shipping a skill, verify:

- [ ] README.md < 100 lines (excluding examples)
- [ ] SKILL.md < 150 lines (excluding examples)
- [ ] Both link to this guide (not duplicate sections)
- [ ] SKILL.md frontmatter includes `name`, `description`, `compatibility`
- [ ] Input/Output schemas are JSON/TS types only (no prose)
- [ ] Error codes documented in error table (not scattered narrative)
- [ ] Tests pass locally (`npm test` / `pytest` / `./tests/run.sh`)
- [ ] docs/USAGE.md exists if workflow is complex (>3 steps)
- [ ] No duplicate "Setup", "Requirements", "Testing", or "Troubleshooting" text

## Enforcement

**Pre-commit hook** invokes validator:

```bash
.\utilities\skill-doc-validator.ps1 -Path skills -Recursive
```

Checks:

- README.md and SKILL.md < line limits (100 / 150 respectively)
- Both files reference `Skill Operator Guide` or link to specific section
- No duplicate "Setup", "Requirements", "Configuration", "Error Handling", "Testing" content
- Input/Output schemas are types-only (no narrative prose)

**Caveman review** flags:

- Narrative in Input/Output schemas
- Troubleshooting outside docs/USAGE.md
- Links within skills/ tree instead of to Skill Operator Guide

**Template:** [skills/_TEMPLATE/](../../skills/_TEMPLATE/) enforces this structure.

**Validator:** [utilities/skill-doc-validator.ps1](../../utilities/skill-doc-validator.ps1) — run locally for compliance check.

## Updating This Guide

Changes to sections (Setup, Requirements, Inputs/Outputs, etc.) must be approved by Tier 1 before publishing. All existing skills update their links within one phase boundary after approval.

---

**Last Updated:** 2026-07-18
**Version:** 1.0
**Owner:** Governance
**Status:** Active enforcement

# governance-matrix-validator

Validate CI governance-matrix workflows against reality and surface hidden or masked cross-repository failures.

**Status**: Active  
**Version**: 0.1.0  
**Runtime**: Node.js / TypeScript  

---

## What It Does

- Inspects governance matrix workflows to identify masking rules (`continue-on-error: true`) hiding real failures.
- Scans linked sibling repositories (`toolforge`, `sigil`, `cic-ingestion`) for missing scripts, broken plugins, and unhoisted dependencies.
- Emits structured triage summaries with severity levels and targeted per-repo remediation steps.

---

## Quick Start

```bash
# Invoke via agent prompt or slash command
claude -p "governance-matrix-validator"

# Or audit specific repo scope
node ./skills/governance-matrix-validator/src/index.mjs --workflow-path .github/workflows/ci-governance-matrix.yml
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation) for standard installation.

This skill requires:
- Node.js 18+
- Permissions: `read:repo`, `write:artifacts`
- Access to workspace sibling repo roots (`toolforge`, `sigil`, `cic-ingestion`)

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for complete schema definitions.

Quick reference:
- **Input**: `{ workflowPath?: string, repoScope?: string[], unmaskOnly?: boolean }`
- **Output**: `{ status: "HEALTHY" | "DEGRADED" | "ACTION_REQUIRED", maskedFailures: Array<...>, repoFindings: Array<...>, recommendedActions: string[] }`

---

## Troubleshooting & Examples

See [docs/USAGE.md](./docs/USAGE.md) for multi-repo triage guides and workflow unmasking walkthroughs.

---

## See Also

- [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) — Canonical reference
- [SKILL.md](./SKILL.md) — Metadata and execution spec
- [docs/USAGE.md](./docs/USAGE.md) — Detailed workflows and examples

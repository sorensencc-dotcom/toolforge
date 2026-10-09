# doc-sync-drift-audit

Detect and report documentation drift in the Toolforge unified wiki and documentation build pipeline.

**Status**: Active  
**Version**: 0.1.0  
**Runtime**: Node.js / TypeScript  

---

## What It Does

- Validates sidebar links against actual pages and flags dead cross-product references.
- Checks doc-sync cache schema versions and safely rejects mismatched or stale indexes.
- Generates structured, reproducible drift receipts under `drift receipts/` for automated triage.

---

## Quick Start

```bash
# Invoke via agent prompt or slash command
claude -p "doc-sync-drift-audit"

# Or invoke programmatically
node ./skills/doc-sync-drift-audit/src/index.mjs --strict-cache
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation) for standard installation.

This skill requires:
- Node.js 18+
- Permissions: `read:repo`, `write:artifacts`
- Unified doc-sync registry at `config/doc-sync.json`

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for complete schema definitions.

Quick reference:
- **Input**: `{ registryPath?: string, strictCache?: boolean, targetVault?: string }`
- **Output**: `{ status: "PASS" | "DRIFT_DETECTED" | "CACHE_REFUSED" | "ERROR", stalePagesCount: number, brokenLinks: Array<...>, receiptPath?: string }`

---

## Troubleshooting & Examples

See [docs/USAGE.md](./docs/USAGE.md) for workflow examples, receipt inspection, and integration patterns.

---

## See Also

- [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) — Canonical reference
- [SKILL.md](./SKILL.md) — Metadata and execution spec
- [docs/USAGE.md](./docs/USAGE.md) — Detailed workflows and examples

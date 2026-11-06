# merge-risk

Deterministic evaluation and scoring of pull request merge safety across 5 weighted dimensions.

**Status**: Active  
**Version**: 0.1.0  
**Runtime**: Node.js (ESM)

---

## What it does

- Assesses PR merge safety across Impact (2x), Verification (2x), Rollback cost (1.5x), Error detection (1x), and Alignment (1x).
- Detects sensitive touchpoints including auth, credentials, permissions, PII, migrations, and infrastructure configurations.
- Produces structured risk tiers (`low`, `medium`, `high`) to govern autonomous staging and automated deployment gates.

---

## Quick Start

```bash
# Evaluate merge risk for a PR or commit range
node skills/merge-risk/src/index.mjs --base origin/main --head HEAD

# Evaluate merge risk for an action card payload
node skills/merge-risk/src/index.mjs --card-id act-01-security-fix
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation) for standard installation.

This skill requires:
- Node.js 18+
- Permissions: `read:repo`

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for complete schema.

Quick reference:
- **Input**: `{ base?: string, head?: string, cardData?: object }`
- **Output**: `{ risk: "low" | "medium" | "high", score: number, breakdown: object, formatted: string }`

---

## Troubleshooting & Examples

See [docs/USAGE.md](./docs/USAGE.md) for troubleshooting, examples, and integration patterns.

---

## Reference

- [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) — Canonical reference (Setup, Requirements, Testing, Error Handling, etc.)
- [SKILL.md](./SKILL.md) — Full metadata spec
- [docs/USAGE.md](./docs/USAGE.md) — Implementation guide + examples

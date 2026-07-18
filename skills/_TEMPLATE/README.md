# [Skill Name]

[One-sentence unique pitch.]

**Status**: [Active|Experimental|Deprecated]
**Version**: 0.1.0
**Runtime**: TypeScript

---

## What it does

[2–3 bullets: outcomes, not process]

- Outcome 1
- Outcome 2
- Outcome 3

---

## Quick Start

```bash
# Invoke directly
claude -p "[Exact trigger text from SKILL.md]"

# Or use as tool
invoke skill-name { input1: "value" }
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation) for standard installation.

This skill requires:

- Node.js 18+
- Permission: `read:repo` / `write:artifacts`
- [Any unique dependencies here]

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for complete schema.

Quick reference:

- **Input**: `input1` (string, required)
- **Output**: `{ status: "success" | "error", data?: any }`

---

## Troubleshooting & Examples

See [docs/USAGE.md](./docs/USAGE.md) for troubleshooting, examples, and integration patterns.

---

## Reference

### Directory Structure

```
[skill-name]/
├── SKILL.md             # Metadata + execution spec
├── README.md            # This file (public pitch)
├── src/
│   └── index.ts         # Implementation
├── tests/
│   └── skill.test.ts    # Test suite
└── docs/
    └── USAGE.md         # Deep workflow docs
```

### Getting Started

Copy this template and customize `SKILL.md` first:

1. Copy template:
   ```bash
   cp -r _TEMPLATE my-new-skill
   ```

2. Edit `SKILL.md` (metadata first):
   - Set `name` (kebab-case ID)
   - Write `description` (1–2 sentences)
   - List `compatibility` (runtime + deps)

3. Update this README.md:
   - Write pitch (one sentence)
   - List "What it does" bullets
   - Link remaining sections to Skill Operator Guide

4. Implement `src/index.ts` (match SKILL.md schema)

5. Write tests in `tests/skill.test.ts` (80%+ coverage)

6. Document workflow in `docs/USAGE.md` (if complex)

7. Verify compliance:
   - `npm test` passes
   - README.md < 100 lines
   - SKILL.md < 150 lines
   - Both reference [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)

---

## See Also

- [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) — Canonical reference (Setup, Requirements, Testing, Error Handling, etc.)
- [SKILL.md](./SKILL.md) — Full metadata spec
- [docs/USAGE.md](./docs/USAGE.md) — Implementation guide + examples
- [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md) — Validation spec
- [../../manifest.json](../../manifest.json) — Tool registry

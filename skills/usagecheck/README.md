# Usage Check

One command, three CLIs: `/usagecheck` figures out whether it's running under Claude Code, Codex, or Grok, and reports that agent's usage/rate-limit data in one normalized shape.

**Status**: Active
**Version**: 0.1.0
**Runtime**: JavaScript (Node 18+, ESM)

---

## What it does

- Detects the current agent (Claude Code, Codex, or Grok) from env vars, or falls back to whatever CLI is on `PATH`
- Claude Code: reads the real stdin-JSON hook payload (or a cached copy) and extracts `rate_limits` — the confirmed, working path
- Codex / Grok: runs a command you've configured once you know it, or heuristically scans that CLI's config directory for a usage-shaped file — and says plainly when it found nothing rather than guessing

---

## Quick Start

```bash
# Auto-detect and report
node skills/usagecheck/src/index.js

# Force a specific agent
node skills/usagecheck/src/index.js --agent codex --json

# Claude Code hook mode (drop-in for the original bash script)
node skills/usagecheck/src/index.js --hook
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation) for standard installation.

This skill requires:

- Node.js 18+
- No external dependencies (Node built-ins only)
- Optional: a `usagecheck.config.json` to wire in Codex/Grok's real usage command once confirmed (see docs/USAGE.md)

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for complete schema.

Quick reference:

- **Input**: `agent` (optional), `stdinText` (optional), `configPath` (optional)
- **Output**: `{ status, agent, available, usage, message, timestamp }`

---

## Troubleshooting & Examples

See [docs/USAGE.md](./docs/USAGE.md) for troubleshooting, examples, and integration patterns.

---

## Reference

### Directory Structure

```
usagecheck/
├── SKILL.md              # Metadata + execution spec
├── README.md              # This file (public pitch)
├── src/
│   └── index.js           # Detection + adapters + CLI
├── tests/
│   └── index.test.js      # node:test suite
└── docs/
    └── USAGE.md            # Deep workflow docs, config format, adapter honesty notes
```

---

## See Also

- [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) — Canonical reference (Setup, Requirements, Testing, Error Handling, etc.)
- [SKILL.md](./SKILL.md) — Full metadata spec
- [docs/USAGE.md](./docs/USAGE.md) — Implementation guide + examples
- [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md) — Validation spec
- [../../manifest.json](../../manifest.json) — Tool registry

# obsidian-ingest-wiki

Validates staged Obsidian raw sources and generates Claude Code prompts for 8-phase wiki synthesis.

**Status**: Operational  
**Version**: 1.0.0  
**Runtime**: Node.js (TypeScript)

---

## What it does

- Validates staging directory integrity (manifest, file count)
- Generates ready-to-copy Claude Code prompts for wiki synthesis
- Supports auto-discovery of latest staging snapshot
- Integrates with kb-sync pipeline

---

## Quick Start

```typescript
// Validate staging
invoke obsidian-ingest-wiki { action: "validate" }

// Generate prompt
invoke obsidian-ingest-wiki { action: "prompt" }
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation).

This skill requires:

- Node.js 18+, TypeScript 5.0+
- configs/obsidian.yaml (kb-sync project)
- Read access to vault/_kb-sync-staging/

---

## Integration

See [SKILL.md](./SKILL.md) for input/output schema and error codes.

For capabilities, configuration, testing, examples:

**→ See [docs/USAGE.md](./docs/USAGE.md)**

---

## Reference

→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Setup, Requirements, Error Handling, Testing.

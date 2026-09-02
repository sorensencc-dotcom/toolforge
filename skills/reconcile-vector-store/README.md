# reconcile-vector-store

Verify Qdrant is in sync with PostgreSQL extraction state.

---

## Quick Start

```bash
reconcile-vector-store check
```

---

## What it does

- Compares vector store with PostgreSQL extraction state and detects drift
- Repairs missing vectors by re-indexing from PostgreSQL
- Reports sync status, count discrepancies, and operation duration

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

For detailed workflow and examples: See [SKILL.md](./SKILL.md).

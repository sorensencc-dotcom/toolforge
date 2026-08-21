# Writing Heuristics and Style Enforcement Engine

Deterministic technical writing heuristics, anti-slop rules, and Google Developer Style enforcement engine for Toolforge and global LLM surfaces.

## Features
- **11 Canonical Writing Rules**: Pure AST-aware prose linting covering Google Style and anti-slop heuristics.
- **Safe Autofix**: High-confidence deterministic transforms for throat-clearing and heading sentence case.
- **Standalone Zero-Dependency CLI**: Self-contained executable with `stylish`, `json`, and `sarif` formatters.
- **Global Instruction Surface**: Managed synchronization blocks for `AGENTS.md` and Copilot instructions.

## Usage
```bash
# Check markdown files
node skills/writing-heuristics/bin/lint-heuristics.js check docs/

# Safe fix with preview
node skills/writing-heuristics/bin/lint-heuristics.js fix --dry-run docs/
```

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

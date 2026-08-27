# TRM Closed-Loop Research

End-to-end Topic Research Mining (TRM) closed-loop pipeline across all registered NotebookLM notebooks in `trm-vault`.

## Usage

```bash
# Multi-notebook live mining
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File C:\dev\schedule-task-wrapper-TRM-Notebooklm-Mine.ps1

# Closed-loop synthesis & knowledge pack generation
$env:TRM_SKIP_MINE='1'; node scripts/run-closed-loop-research-v2.mjs

# Cognitive query expansion triage
npm run trm:triage:daily
```

## Overview

- Queries all registered NotebookLM notebooks in `notebooklm-registry.json`
- Evaluates hardware-aware WhichLLM model benchmarks
- Synthesizes Layer 2 semantic wiki notes in `wiki/research/`
- Drafts structured RFC decision notes with grounded citations
- Rebuilds thematic `.nlm_pack` knowledge packs

---

**Full reference:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

# TRM Closed-Loop Research - Usage Guide

End-to-end Topic Research Mining (TRM) closed-loop pipeline across registered NotebookLM notebooks in trm-vault.

**Version**: 1.0.0
**Runtime**: TypeScript wrapper plus repo scripts (Node, PowerShell)
**Status**: active
**Category**: research
**Entrypoint**: src/index.ts (thin wrapper around repo orchestrator)

---

## Purpose

This skill documents and wraps the live TRM loop:

1. Multi-notebook mining into trm-vault research-gaps markdown
2. Closed-loop orchestration (WhichLLM sweep, gaps snapshot, Layer 2 wiki synthesis, .nlm_pack rebuild)
3. Cognitive gap triage / RFC drafting against the SQLite knowledge cache
4. Wiki publish

The in-skill TypeScript entry calls scripts/run-closed-loop-research-v2.mjs from the C drive dev repo root, with optional TRM_VAULT and TRM_SKIP_MINE.

---

## When to use

Triggers / phrases: run closed loop research, mine notebooks, trm closed loop, refresh research gaps, sweep trm vault, summarize new finds and gaps.

Use when you need a full vault sweep rather than a single-topic research-questions pass.

---

## Prerequisites

- Node and PowerShell available
- Repo scripts present:
  - schedule-task-wrapper-TRM-Notebooklm-Mine.ps1 at the C drive dev root
  - scripts/run-closed-loop-research-v2.mjs
- TRM vault (default C:\Users\soren\trm-vault) with notebooklm-registry.json and research-gaps paths
- For triage: package scripts trm:triage:daily / trm:triage:auto and .kb_cache/knowledge.db
- For publish: wiki:publish package script

---

## How to run

### 1. Multi-notebook mining sweep

Run the scheduled-task wrapper PowerShell file at the C drive dev root (NoProfile, ExecutionPolicy Bypass). It mines notebooks registered in notebooklm-registry.json into trm-vault/trm/research-gaps/ markdown tables (cic-kb, daily research, willow-run videos, cast-iron charlie logs, archive notes, social sources, aviation/engineering topics, and related files listed in SKILL.md).

### 2. Closed-loop orchestration and wiki synthesis

From the C drive dev repository root, set TRM_SKIP_MINE=1 if mining already ran, then execute scripts/run-closed-loop-research-v2.mjs.

In-skill wrapper (from compiled or ts-node context):

- runClosedLoopResearch({ vaultRoot?, skipMine? })
- Defaults: TRM_VAULT from env or C:\Users\soren\trm-vault; TRM_SKIP_MINE from skipMine

Orchestrator steps (from SKILL.md):

0. WhichLLM benchmark sweep via _integration/model_selection.json
1. Gaps ingestion to trm-research-gaps.md
2. NotebookLM grounding upload of the gaps snapshot
3. Topic derivation (open-contradictions, under-sourced, adjacent-topics, follow-up)
4. Layer 2 wiki synthesis under wiki/research/
5. Audit log append to wiki/Log.md
6. Rebuild thematic .nlm_pack/pack_*.txt files

### 3. Gap triage and RFC drafting

- Full daily wrapper: package script trm:triage:daily
- Direct auto provider chain: trm:triage:auto (Ollama then OpenRouter then Heuristic)

Produces wiki/research/rfc-gap-*.md and links in-progress gaps in trm-research-gaps.md.

### 4. Publish wiki

Package script wiki:publish synchronizes and pushes wiki docs.

### Tests referenced by the skill

- node --test kb-sync/tests/query-expander.test.mjs
- package scripts test:cache and test:trm

---

## Inputs and outputs

### Inputs

- vaultRoot (optional): TRM vault path
- skipMine (optional boolean): set TRM_SKIP_MINE for the orchestrator
- provider (optional, triage scripts): auto | ollama | openrouter | offline

### Outputs

- Updated research-gaps markdown under the vault
- trm-research-gaps.md consolidated snapshot
- wiki/research/ Layer 2 pages and rfc-gap-*.md notes
- wiki/Log.md audit entries
- .nlm_pack/pack_*.txt thematic packs

---

## Examples

Full evening loop:

1. Run the NotebookLM mine wrapper.
2. Set TRM_SKIP_MINE and run run-closed-loop-research-v2.mjs.
3. Run trm:triage:daily.
4. Run wiki:publish.
5. Spot-check wiki/research and .nlm_pack outputs.

Synthesis-only refresh (mining already done):

- skipMine true / TRM_SKIP_MINE=1 then run the orchestrator only.

---

## Troubleshooting

**VAULT_NOT_FOUND**

TRM vault directory missing. Set TRM_VAULT or pass vaultRoot to the wrapper.

**Mining wrapper fails**

Confirm notebooklm-registry.json and NotebookLM access. Fix mining before trusting gap snapshots.

**Orchestrator script missing**

src/index.ts resolves ../../../scripts/run-closed-loop-research-v2.mjs from the skill folder (repo root scripts/). Run from a full C drive dev checkout.

**Triage without cache**

Ensure .kb_cache/knowledge.db exists and test:cache passes; otherwise provider chain may degrade to heuristic.

**Opaque bits**

WhichLLM matrix details and NotebookLM upload internals live in the repo orchestrator, not in this skill folder. This USAGE documents the operator sequence and wrapper only.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- SKILL.md / README.md / SKILL.json
- Related: research-questions, wiki publish tooling, kb-sync query expander

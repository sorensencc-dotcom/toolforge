# trm-closed-loop-research — Integration Diagram

```
User / Agent ("run closed loop research")
        |
        | pwsh schedule-task-wrapper-TRM-Notebooklm-Mine.ps1
        v
trm mine-notebooklm (x7 Notebooks) -> trm-vault/trm/research-gaps/*.md
        |
        | node scripts/run-closed-loop-research-v2.mjs
        v
WhichLLM Model Selection + Snapshot Consolidation -> trm-research-gaps.md
        |
        |-- Layer 2 Wiki Synthesis       -> wiki/research/*.md
        |-- Knowledge Pack Compilation   -> .nlm_pack/pack_*.txt
        |-- Cognitive Gap Triage Engine  -> wiki/research/rfc-gap-*.md
        v
npm run wiki:publish -> GitHub Wiki Live Documentation
```

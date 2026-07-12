# obsidian-ingest-wiki Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      OBSIDIAN VAULT INTEGRATION                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  kb-sync Pipeline                                                    │
│  ─────────────────                                                   │
│  npm run kb:sync:obsidian                                            │
│         │                                                             │
│         └─→ modules/obsidian/ingest-obsidian.sh                      │
│              (Stage raw sources)                                     │
│              │                                                       │
│              └─→ vault/_kb-sync-staging/kb-sync/YYYYMMDD-HHMMSS/    │
│                   (Immutable raw sources + manifest)                 │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Toolforge Skill: obsidian-ingest-wiki                               │
│  ──────────────────────────────────────────                          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ handler(action: "validate" | "prompt")                       │   │
│  │                                                               │   │
│  │ ┌─ ACTION: VALIDATE ─────────────────────────────────────┐   │   │
│  │ │ • Check staging directory exists                       │   │   │
│  │ │ • Verify FILES.manifest.txt present                   │   │   │
│  │ │ • Count staged files                                   │   │   │
│  │ │ • Return: {status, fileCount, errors}                │   │   │
│  │ └────────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │ ┌─ ACTION: PROMPT ───────────────────────────────────────┐   │   │
│  │ │ • Validate staging (run validate first)                │   │   │
│  │ │ • Resolve paths (staging, vault root)                 │   │   │
│  │ │ • Generate 8-phase workflow prompt                    │   │   │
│  │ │ • Include schema reference & constraints              │   │   │
│  │ │ • Return: {status, prompt, paths, timestamp}          │   │   │
│  │ └────────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │ Configuration: reads from configs/obsidian.yaml               │   │
│  │ Auto-discovery: finds latest staging if path not provided    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────────┐      ┌──────────────┐   ┌──────────────┐
   │   Cowork    │      │   Claude     │   │ kb-sync Logs │
   │ (Agent API) │      │   Code (CLI) │   │ (Audit Trail)│
   │             │      │              │   │              │
   │ Registers   │      │ Consumes     │   │ Updates      │
   │ skill for   │      │ prompt +     │   │ manifest &   │
   │ cowork://   │      │ runs 8-phase │   │ audit trail  │
   │ toolforge   │      │ workflow     │   │              │
   └─────────────┘      └──────────────┘   └──────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Wiki Updates    │
                    │  ────────────── │
                    │ Entity pages    │
                    │ Concept pages   │
                    │ Index.md        │
                    │ Log.md          │
                    └──────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Git Commit      │
                    │  ────────────── │
                    │ Full audit trail│
                    │ Change summary  │
                    └──────────────────┘


LAYERS (Three-Layer Vault Architecture)
═══════════════════════════════════════

Layer 1: RAW SOURCES (Immutable)
────────────────────────────────
vault/_kb-sync-staging/kb-sync/20260711-174821/
├── FILES.manifest.txt
├── modules/
├── docs/
└── configs/

Layer 2: WIKI (LLM-Maintained, Human-Curated)
──────────────────────────────────────────────
vault/wiki/
├── kb-sync/
│   ├── run-all.sh.md
│   ├── flatten.sh.md
│   └── index.md
├── concepts/
│   ├── three-layer-vault-architecture.md
│   └── ...
├── Index.md
└── Log.md

Layer 3: SCHEMA (Reference, Documentation)
───────────────────────────────────────────
docs/targets/obsidian.md
modules/wiki/operator-workflow.md
modules/wiki/schema.md
modules/wiki/lint-rules.md


WORKFLOW (Phases 1-8)
═════════════════════

Phase 1: INGEST
   ↓ Identify new entities and concepts from staged sources
   
Phase 2: LINT
   ↓ Verify wiki for structural/semantic issues
   
Phase 3: UPDATE
   ↓ Create/modify entity and concept pages
   
Phase 4: CROSS-REF
   ↓ Establish bidirectional links
   
Phase 5: LINT
   ↓ Re-verify after updates
   
Phase 6: LOG
   ↓ Record session metadata in Log.md
   
Phase 7: REVIEW
   ↓ Operator spot-checks and approves
   
Phase 8: COMMIT
   ↓ Git commit with change summary


STATUS INDICATORS
═════════════════

✅ Validation Passed
   • Staging dir exists
   • Manifest present
   • Files > 0
   
✅ Prompt Generated
   • Paths resolved
   • Phases included
   • Constraints listed
   
✅ Wiki Updated
   • Entities created/updated
   • Concepts created/updated
   • Index.md updated
   • Log.md updated
   
✅ Committed
   • Git commit with full change summary
```

---

**Integration Owner**: CIC Team  
**Last Updated**: 2026-07-11  
**Status**: Operational

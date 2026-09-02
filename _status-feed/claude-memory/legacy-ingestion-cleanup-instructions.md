---
name: legacy-ingestion-cleanup-workflow
description: Multi-phase deterministic repo scan + archive plan for legacy ingestion engine; non-destructive with approval gates
metadata: 
  node_type: memory
  type: reference
  originSessionId: d2fbbf7d-1d34-4479-994f-38749ce93498
---

# Legacy Ingestion Cleanup Instruction Pack

**Status:** Standing instruction. Activate via explicit request or trigger file discovery.  
**Scope:** cic-ingestion/ legacy engine mapping + cleanup workflow  
**Entry:** Phase 1 repo scan → Phase 2 analysis → Phase 3 plan → Phase 4 approval → Phase 5 execution

---

## PHASE 1 — REPO DISCOVERY (MANDATORY)

Scan entire `C:\dev\rewrite-mcp\castironforge\cic-ingestion\` and produce structured map:
- All Python ingestion files (language, active/unused, legacy refs, conflicts with producer.ts)
- Ingestion CLI wrappers
- Ingestion scripts in `/src`, `/scripts`, `/tools`, root
- package.json ingestion scripts
- TS queue engine file refs to ingestion
- MCP adapter refs to ingestion
- Operator console polling logic refs to ingestion

Output: Full path, language, status, legacy/new engine connectivity.

---

## PHASE 2 — LEGACY ANALYSIS

After mapping, produce:

**Legacy Engine:**
- Entry file, helpers, job creation, envelope building, file discovery, nondeterministic behavior, side effects

**New Engine:**
- producer.ts, queue schema, envelope schema, correct behavior model

**Diff-style comparison:**
- Legacy → new replacement mapping
- Reusable logic
- Must-remove logic

---

## PHASE 3 — CLEANUP PLAN (NON-DESTRUCTIVE)

1. **Archive plan:** Move to `cic-ingestion/legacy/` (preserve, don't delete)
2. **Extraction plan:** Port reusable logic → `src/ingestion/{discovery,mime,envelope}.ts`
3. **Replacement plan:** New `src/ingestion/index.ts` (no loops, watchers, deterministic)
4. **Operator console plan:** Update health checks → queue engine only
5. **CIC validation plan:** Test commands (npm test, tsc, report)

---

## PHASE 4 — APPROVAL GATES

Before execution, ask user:
1. Archive or delete legacy engine?
2. Port reusable logic auto?
3. Generate deterministic stub?
4. Update operator console?
5. Generate patches or PRs?
6. Update CIC tracker?

**No action until explicit approval.**

---

## PHASE 5 — EXECUTION

After approval:
- Generate patches
- Generate new files
- Move legacy files
- Update operator console
- Validate determinism
- Produce final diff
- Update CIC section tracker

---

## CLI Activation

```bash
claude --instruction-file legacy-ingestion-cleanup-instructions.md \
  --phase 1 \
  --repo-path C:\dev\rewrite-mcp\castironforge\cic-ingestion\
```

Or inline:

```bash
claude "Execute Phase 1 repo discovery for legacy ingestion cleanup. Use legacy-ingestion-cleanup-instructions.md as guide."
```

---

## Context

File contract: deterministic envelope building, no watchers, producer.ts integration only. Cloud extension layer parallel implementation (not blocking). CIC drift baseline untouched.

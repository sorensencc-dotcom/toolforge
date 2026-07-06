# ASHFALL Integration Diagram

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE SESSION                          │
│                                                                   │
│  [Work] → [Work] → [Work] → [Checkpoint] → ... → [Session End] │
└─────────────────────────────────────────────────────────────────┘
                                                          ↓
                                            ┌────────────────────┐
                                            │  "Let the ash fall" │
                                            └────────────────────┘
                                                          ↓
                                    ┌────────────────────────────────────┐
                                    │      ASHFALL ORCHESTRATOR          │
                                    │                                    │
                                    │  1. GATHER  → git state            │
                                    │  2. BURN    → compress context    │
                                    │  3. AUDIT   → Four Questions      │
                                    │  4. SEAL    → memory manifest     │
                                    │  5. HANDOFF → ranked roadmap      │
                                    └────────────────────────────────────┘
                                                          ↓
                                    ┌────────────────────────────────────┐
                                    │      ASHFALL OUTPUT                │
                                    │                                    │
                                    │  • Blind spot audit (HIGH/MED/LOW) │
                                    │  • Prioritized roadmap (1–5)       │
                                    │  • Memory manifest                 │
                                    │  • Verification checklist          │
                                    └────────────────────────────────────┘
                                                          ↓
                                    ┌────────────────────────────────────┐
                                    │    MEMORY SYSTEM                   │
                                    │                                    │
                                    │  ~/.claude/projects/*/memory/      │
                                    │  • ashfall-wrap-YYYY-MM-DD.md     │
                                    │  • Audit findings                  │
                                    │  • Next session roadmap            │
                                    └────────────────────────────────────┘
                                                          ↓
                                    ┌────────────────────────────────────┐
                                    │    NEXT SESSION ONBOARD            │
                                    │                                    │
                                    │  Memory loaded → context prepared  │
                                    │  Blockers exposed → priorities set │
                                    │  Assumptions verified              │
                                    └────────────────────────────────────┘
```

## Data Flow

```
GIT STATE
  ├─ git status --porcelain
  ├─ git log --oneline
  ├─ git diff HEAD~5..HEAD --stat
  └─ current branch
          ↓
      ┌─────────────┐
      │   GATHER    │ → GatherOutput
      └─────────────┘
          ↓
    ┌──────────────────────┐
    │ modifiedFiles[]      │
    │ uncommittedChanges   │
    │ recentCommits[]      │
    │ architecturalDeltas  │
    │ contextBoundaries[]  │
    └──────────────────────┘
          ↓
      ┌─────────────┐
      │    BURN     │ → Markdown summary
      └─────────────┘
          ↓
    ┌──────────────────┐
    │ Compressed text  │ ← Remove noise
    │ Preserve signal  │
    └──────────────────┘
          ↓
      ┌─────────────┐
      │   AUDIT     │ → AuditFinding[]
      └─────────────┘
          ↓
    ┌──────────────────────────────┐
    │ Q1: Least confident topic   │
    │ Q2: User blind spots        │
    │ Q3: Critical assumptions    │
    │ Q4: Verification steps      │
    │ Ranked by severity          │
    └──────────────────────────────┘
          ↓
      ┌─────────────┐
      │    SEAL     │ → Memory manifest
      └─────────────┘
          ↓
    ┌─────────────────────────────┐
    │ YAML frontmatter:           │
    │  name, description, type    │
    │  timestamp, metadata        │
    │ Session audit trail         │
    │ Findings + next checks      │
    └─────────────────────────────┘
          ↓
      ┌─────────────┐
      │   HANDOFF   │ → RoadmapItem[]
      └─────────────┘
          ↓
    ┌──────────────────────────────┐
    │ Priority 1–5                │
    │ Blocker flags               │
    │ Context + source            │
    │ Verification evidence       │
    └──────────────────────────────┘
          ↓
    ┌──────────────────────────────┐
    │  AshfallOutput (JSON/MD)     │
    │  Summary + audit + roadmap   │
    │  + nextSessionMemory         │
    └──────────────────────────────┘
```

## Integration Points

### Upstream
- **Claude Code Session** — invoked at end via "Let the ash fall"
- **Git Repository** — reads state, commits, diffs
- **Current Working Directory** — scans modified files

### Downstream
- **Memory System** — writes session manifests to `~/.claude/projects/*/memory/`
- **Roadmap Reranking** — feeds priority 1–5 into next session planning
- **CI/CD Gates** — verification steps used in deployment checklists
- **Audit Trail** — blind spot findings logged for continuity

## Error Handling

All phases fail-safe:
- **Gather timeout** → use cached git state, skip architectural deltas
- **Audit missing context** → LOW severity finding, skip that question
- **Seal write failure** → retry with tmp→flush→rename atomic pattern
- **Handoff corruption** → use fallback roadmap (priority by severity)

## Performance

| Phase | Typical Duration | Output Size |
|-------|------------------|-------------|
| Gather | 1–2s | 500B–2KB |
| Burn | <1s | 1KB–5KB |
| Audit | 2–3s | 2KB–6KB |
| Seal | <1s | 3KB–8KB |
| Handoff | 1s | 1KB–4KB |
| **Total** | **5–10s** | **~10–25KB** |

## Scope Behavior

| Scope | Target | Phases | Memory |
|-------|--------|--------|--------|
| `full` | Entire session | All 5 | 10–25KB |
| `PHASE-XX` | Single phase | All 5 (filtered) | 3–8KB |
| `partial` | Memory only | 1, 2, 4 | 1–3KB |

---

ASHFALL operational. Burn the noise. Keep the signal.

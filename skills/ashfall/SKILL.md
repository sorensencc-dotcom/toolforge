# ASHFALL Skill

Deterministic session-termination and context-handoff engine for Cast Iron systems.

## What It Does

5-step industrial burn for session wrapping:

1. **Gather** — Collect git state, modified files, commits, architectural deltas
2. **Burn** — Compress context, prune drift, preserve signal
3. **Audit** — Apply Four Questions framework for blind-spot detection
4. **Seal** — Generate deterministic memory manifest with atomic write
5. **Handoff** — Rank roadmap (1–5 priority) + emit token-bounded memory

## Use Cases

- Wrap complex sessions with verified assumptions
- Surface blind spots and confidence gaps before deployment
- Rank work for next session with blocker flags
- Compress context while preserving structural truth
- Prepare memory artifacts for cross-session continuity

## Invocation

```bash
ashfall --scope=full|PHASE-26|partial
ashfall --verify --output-format=json|markdown
```

At session end: **"Let the ash fall."**

## Output

Structured JSON + Markdown:
- **summary** — modified files, architectural changes, pending commits
- **blindSpotAudit** — findings ranked by severity, verification steps
- **prioritizedRoadmap** — 1–5 priority with blocker flags
- **nextSessionMemory** — compressed memory manifest

## Philosophy

Burn the noise.  
Keep the signal.  
Seal the truth.  
Prepare the next phase.

Operator-grade. Deterministic. Industrial.

---

See [README.md](README.md) and [docs/USAGE.md](docs/USAGE.md) for details.

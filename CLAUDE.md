# Claude Code Configuration

## Governance Framework

**Authority Model:** 3-tier (Tier 1: decision | Tier 2: execution | Tier 3: automation)

**Core Principles:**
1. Tier 1 Decides, Tier 2 Executes, Tier 3 Automates
2. Memory Shapes Strategy (long-term > project > working)
3. Safety > Process (boundaries absolute; gates flex)
4. Conform Before Shipping (patterns, infra, design align at charter phase)
5. Document Decisions, Not Steps (why/what, not how-to minutiae)

**See:** `docs/meta/global-operating-rules-cic-rewrite-labs.md` (v2.0) — comprehensive governance, 3-class output taxonomy, conformance gate, safety boundaries, drift response.

## gstack

Use `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:

- `/office-hours`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/plan-design-review`
- `/design-consultation`
- `/design-shotgun`
- `/design-html`
- `/review`
- `/ship`
- `/land-and-deploy`
- `/canary`
- `/benchmark`
- `/browse`
- `/connect-chrome`
- `/qa`
- `/qa-only`
- `/design-review`
- `/setup-browser-cookies`
- `/setup-deploy`
- `/setup-gbrain`
- `/retro`
- `/investigate`
- `/document-release`
- `/document-generate`
- `/codex`
- `/cso`
- `/autoplan`
- `/plan-devex-review`
- `/devex-review`
- `/careful`
- `/freeze`
- `/guard`
- `/unfreeze`
- `/gstack-upgrade`
- `/learn`

## Session Wrap & Learnings

End each session: run `/retro` to log insights, patterns, fixes, and decisions. Learnings feed forward to future sessions via `/learn` — cuts repeat debugging and rediscovery.

## GBrain Search

For semantic code questions ("where's the auth logic?", "how's billing handled?"), use:

- `gbrain search <query>` — semantic search
- `gbrain code-def <symbol>` — symbol definition
- `gbrain code-refs <symbol>` — find all references
- `gbrain code-callers <symbol>` — find callers

Faster than Grep for concept questions. Setup: `/setup-gbrain --full`

## Skill Approval & Registration

### Toolforge Skill (Auto-Install)

Skills auto-install to toolforge library on merge to main IF:

- Registered in `manifest.json` with complete metadata (name, runtime, entrypoint, owner, category, status)
- Structure: skill.json + src/ + tests/ + docs/ (or equivalent for bash/node)
- Tests pass locally (`npm test` or equivalent)
- Documentation complete (README or docs/ with usage examples)
- Caveman review pass (no blockers)

Example: kb-sync-nightly (bash skill, registered, tested, documented)

### Project Tool (No Auto-Install)

Project tools do NOT auto-install if:

- Located in project `/modules/<category>/` subdirectory
- Invoked via `npm run` scripts (defined in package.json)
- Part of larger project (not standalone skill distributed externally)
- No toolforge manifest.json registration entry

Example: obsidian:ingest-wiki (bash module in kb-sync, invoked via `npm run wiki:ingest:obsidian:validate`, no external distribution)

### Governance Changes

Any change to skill approval rules or tier classification requires Tier 1 approval.

## Drift Prevention: Embedded Workflow Checklists

**Active immediately (2026-07-12).** Run checklist BEFORE critical action.

### Pre-Artifact Checklist (Before Publishing)

- [ ] Classification: Class 1/2/3?
- [ ] Approval needed: Tier 1?
- [ ] Approved? (not assumption — verify)
- [ ] Design system compliance: CIC/standard/plain?
- [ ] Storage: Artifact tool (claude.ai)?

**If any check fails: STOP. Do not publish without fix or explicit override.**

### Pre-Write Checklist (Before Creating Files)

- [ ] File type: governance / drift / session note / code / config?
- [ ] Correct location: CLAUDE.md / memory/ / repo / other?
- [ ] Verified against Global Operating Rules?

### Pre-Governance Checklist (Before Writing Rules)

- [ ] Does this claim mechanisms exist?
- [ ] Can I point to code/config that proves it?
- [ ] No "automatic" claims without verification?

**Reference**: See memory/workflow-checklists-embedded.md for full details.

**Prevents**: Unauthorized artifacts, design non-compliance, wrong storage, false governance claims.

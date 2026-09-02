---
name: skills-policy-agent-requirement
description: Automated governance system enforcing shared skills library adoption with exception mechanism for CLI-native skills
metadata: 
  node_type: memory
  type: project
  originSessionId: 95e8abc3-a9d7-4fd8-8502-baaa50d91773
---

## Skills Policy Agent — Governance Requirement

**Status:** Blocked awaiting approval 
**Timeline:** 2-3 hours (parallel with Phase 44.4/45) 
**Mandate Source:** Antigravity governance + user requirement (2026-06-05)

### The Problem

Developers create ad-hoc local skills in `/cli-local-skills`, `/tools/custom-skills`, scattered locations. Over time:
- Skills duplicate across CLIs
- Never promoted to shared library
- Orchestrator can't use them
- Maintenance burden multiplies
- Discoverability impossible

### The Solution

Automated policy agent that evaluates every new skill against **6 weighted criteria**:

| Criterion | Weight | Threshold | Purpose |
| --- | --- | --- | --- |
| Generalizability | 25% | score >= 0.70 | Not CLI-specific |
| Schema Completeness | 20% | required | Valid JSON schema |
| Test Coverage | 20% | >= 80% | Production quality |
| Documentation | 15% | score >= 0.60 | Purpose + examples |
| Production Readiness | 15% | required | Error handling, no code smells |
| Non-CLI-Specific | 5% | required | No TTY/argv/process.exit |

**Pass Threshold:** Overall score >= 0.70

### Workflow

```
Developer writes skill
    ↓
Pre-commit hook evaluates
    ↓
┌─ PASS (score >= 0.70)
│  ├→ Approve for skills/ (shared library)
│  └→ Available to orchestrator + all CLIs
│
└─ FAIL (score < 0.70)
   ├→ Option A: Fix it (tests, docs, schema)
   ├→ Option B: Request exception (PR approval)
   └→ Option C: Move to cli-local-skills/ (local only)
```

### Exception Mechanism

CLI-native skills can be registered in `SKILLS_EXCEPTIONS.md` with:
- Name, reason, approved reviewer, date, review URL
- Optional sunset date for future re-evaluation
- Prevents false positives on legitimate CLI tools

**Examples of valid exceptions:**
- `cli-version-checker` — Reads ./package.json (CLI-specific)
- `terminal-colors` — ANSI codes for TTY (non-portable)
- `interactive-prompt` — Readline input (headless-incompatible)

### Implementation Modules

1. **Criterion Evaluator** (400 lines) — Weighted scoring on 6 criteria
2. **Exception Manager** (250 lines) — Registry with approval workflow
3. **Pre-Commit Hook** (150 lines) — Blocks non-compliant commits
4. **CLI Validator** (300 lines) — Detects patterns: yargs, commander, readline, process.argv, tty
5. **Policy Report Generator** (200 lines) — Guides developers with actionable feedback

### Integration Points

- Git pre-commit hook (enforcement)
- PR template (checklist)
- Operator console (exception list + sunset dates)
- SUGGESTION_LOG.md (policy decisions)

### How to Apply

**When approving Phase 44.4 or Phase 45:** Implement this policy agent first (2-3 hours) before building new skills. Ensures all Phase 45 skills and future skills follow governance from day one.

**CLI Commands:**
```bash
npm run policy:check -- skills/my-skill          # Evaluate skill
npm run policy:report -- skills/my-skill          # Generate report
npm run policy:exceptions -- list                 # View exception registry
npm run policy:exceptions -- add --name=... --approver=... # Register exception
npm run policy:audit                              # Audit all skills
```

**Files to Create:**
- `tools/policy-agent/` (5 modules + tests)
- `.husky/pre-commit` (policy hook)
- `SKILLS_EXCEPTIONS.md` (exception registry)
- `SKILLS_POLICY_AGENT.md` (user guide)

### Success Criteria

✅ All new skills evaluated before commit 
✅ Shared library contains only production-ready, generalizable skills 
✅ CLI-native exceptions documented with reasoning + sunset dates 
✅ Zero ad-hoc local skills outside exceptions 
✅ Developers guided toward shared library 

### Related Phases

- Phase 44.4: Autonomous Orchestrator (can consume Policy Agent outputs)
- Phase 45: 7 New Skills (evaluated by Policy Agent before commit)
- Future: All skills inherit policy governance

---

**Recommendation:** Implement Skills Policy Agent **before** Phase 44.4/45, so all new work inherits governance from start.

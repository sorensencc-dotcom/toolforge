# Weekly Personal Skill-Audit Discipline (Updated 2026-06-28)

**Version:** 2.0 (with integrated drift-check as Step 0)  
**Effective:** 2026-06-28  
**Reason for Update:** Critical drift (21+ items) discovered during 2026-06-28 audit; preventive monitoring now required

---

## Moves 0–8 Execution Sequence

### Move 0: Drift Baseline (NEW - First Step)

**Why first:** Drift was invisible in previous audits; early detection prevents surprises.

**Execute:**

```powershell
# Option A: Manual scan (during audit)
cd C:\dev\toolforge
& ".\sync-tools\multiRepoRoadmapSync\multiRepoRoadmapSync.cjs"
# Generates: drift/DRIFT-REPORT.md

# Option B: Via scheduled skill (when available)
Invoke-CliScript -Skill toolforge-drift-monitor -Action scan
```

**Report:**
- Status: `OK` | `WARNING` | `CRITICAL`
- Output file: `drift/DRIFT-REPORT.md`

**Decision logic:**
```
If CRITICAL:
  → HALT audit
  → Escalate to operator (Chris)
  → Execute resync
  → Run audit again (from Move 0)
  
If WARNING:
  → Continue audit (Moves 1–8)
  → Note drift items in final report
  → Recommend investigation in next session

If OK:
  → Proceed normally (Moves 1–8)
```

---

### Move 1: Scan Friction/Workflows

**What to look for:**
- Repeated friction points (>2 occurrences in memory or commits)
- Broken workflows (things that keep failing)
- Corrections needed (post-incident patches)

**Evidence sources:**
- `MEMORY.md` (if exists) — operational notes, context, patterns
- Git log (last 7 days) — recent commits, frequency
- Session context — tasks attempted, blockers hit
- Drift report (from Move 0) — multi-repo sync issues

**Output:** List of friction signals with evidence

---

### Move 2: Identify Personal-Skill Candidates

**Filter:**
- Personal skills only (not repo/agent/system skills)
- Reusable (will be invoked 2+ times)
- Evidence-backed (not speculative)
- Friction-addressing (solves real problems)
- Governance-aligned (fits CIC/RL/Toolforge structure)
- Deterministic (repeatable, testable)
- Measurable (success metrics clear)

**Output:** Table of candidates that pass all 6 checks

---

### Move 3: Require Evidence

**For each candidate:**
- Cite specific evidence (git commit, file, line number)
- Quote friction signal verbatim
- Show precedent (similar skills already built, or pattern from domain)

**Output:** Annotated candidate list with evidence citations

---

### Move 4: Show Proposals (No Code Yet)

**For each candidate, document:**
- Name + version (e.g., `toolforge-drift-monitor`, 0.1.0)
- Purpose (1-2 sentences)
- Trigger (weekly, manual, event-based)
- Output (what it produces)
- Implementation approach (wraps existing code or new build?)
- Success metrics (how to measure it works)

**Output:** Proposal table (markdown), ready for discussion

---

### Move 5: Check Deprecation

**Review existing personal skills:**
- Are any unused? (no invocations in 4+ weeks)
- Are any superseded? (new skill replaces old one)
- Are any drifting? (implementation diverged from original purpose)

**Output:** Deprecation assessment (none / candidates list)

---

### Move 6: Detect Skill Drift

**Check:**
- **Phase alignment:** Tool/skill tracking vs actual completion state
- **Test closure:** Tests written but not run / failing tests not addressed
- **Parallel-phase coordination:** Two skills working on same thing inconsistently

**Indicators:**
- Gap between skill description and current behavior
- Test count increasing but not reducing (tests accumulating, not closing)
- Multiple skills managing same concern (governance fragmented)

**Output:** Drift assessment (none / items to realign)

---

### Move 7: Await Approval

**DO NOT BUILD without approval.**

**Present recommendations:**
- Option A: Implement all recommended skills
- Option B: Implement subset (Priority 1 only)
- Option C: Defer (monitor for additional friction)
- Option D: Custom direction

**Get operator sign-off before Move 8.**

---

### Move 8: Report & Execute

**Only after approval in Move 7.**

**Report:**
- Created: List of new skills + versions
- Updated: List of deprecated skills + replacements
- Skipped: Candidates deferred with reason
- Deleted: (if any)
- Process changes: (if any)

**Save:** Report to `C:\dev\toolforge\audit\AUDIT-YYYY-MM-DD.md`

**Execute:** Build approved skills using appropriate tool (skill-creator, manual .skill file creation, etc.)

---

## Governance Rules

**Personal skills only.** No repo skills, agent skills, or system infrastructure.

**Bias toward no change.** Require clear friction evidence before proposing new skills.

**Show all recommendations before making changes.** Present as table with evidence; operator approves before implementation.

**Never auto-write files without approval.** Moves 0–7 are analysis-only; only Move 8 (approved) creates/modifies files.

**It is OK to report "no audit needed" or "no changes."** Not every week will yield new skills.

---

## Audit Timing

**When:** Weekly, same day/time (Sunday 14:00 UTC suggested)

**Duration:** ~30 min for analysis (Moves 0–7); ~1–2 hours for implementation (Move 8, if approved)

**Operator involvement:**
- Move 0–6: Autonomous (no questions)
- Move 7: Await approval
- Move 8: Execute approved changes

---

## Evidence Checklist (Move 3)

For each candidate, answer:

- [ ] Where did friction appear? (git commit / memory file / session transcript)
- [ ] How many times has this friction occurred? (>2 is strong signal)
- [ ] What existing implementation can this skill wrap? (or is new code needed?)
- [ ] Who will invoke this skill? (Chris / automation / both?)
- [ ] How will success be measured? (automated check / manual test / pattern elimination?)

---

## Session Capture Template

**At end of each session, note:**

```markdown
## Session: [DATE]

### Friction Points
- [Describe repeated problem 1]
  - Evidence: [git commit / file / line]
  - Frequency: [2x / 3x / ongoing]
- [Describe repeated problem 2]

### Workflows That Almost Worked
- [Describe near-miss or improvable process]

### Corrections Made
- [Describe post-incident fix]
```

**Purpose:** Feeds Move 1 (friction scanning) in next audit.

---

## Scheduled Task Integration (Future)

Once `toolforge-drift-monitor` skill is installed, add:

```powershell
# Weekly audit trigger
Register-ScheduledTask -TaskName "weekly-skill-audit" `
  -Trigger (New-ScheduledTaskTrigger -Weekly -DayOfWeek Sunday -At 14:00) `
  -Action (New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-File C:\dev\toolforge\audit\run-audit.ps1")
```

This will ensure Move 0 (drift check) runs automatically before audit analysis.

---

## Sign-Off

**Version:** 2.0  
**Effective Date:** 2026-06-28  
**Reason:** Integrated drift-check as Move 0 (preventive)  
**Approved by:** Chris Sorensen  
**Next Review:** 2026-07-05

---

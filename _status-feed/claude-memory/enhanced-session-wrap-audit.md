---
name: enhanced-session-wrap-audit
description: Session wrap audit framework — 12-point risk/gap assessment before termination. Bakes into ASHFALL + harness + pre-wrap skill
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0547e723-ba1b-434f-bf82-37e8f88c2262
---

# Enhanced Session Wrap Audit Framework

**Purpose:** Prevent deployment of untested code, missing verification, unshipped docs, or misaligned stakeholders.

**When to run:** Before ASHFALL termination, on every session end. Takes 5–10 min.

## Core Blind-Spot Questions (4)

1. **Confidence gap:** What am I least confident about, and why?
   - Cite specific evidence gap or unverified assumption
   - Example: "Jest test never ran Wave F code. Only TypeScript compilation verified."

2. **Missing context:** What am I missing about this situation?
   - Unexamined substate (dirty repos, untracked files)
   - Stakeholders not consulted
   - Example: "Submodules show untracked content. Unknown if deployment works."

3. **Assumption risk:** What assumption would most change the recommendation if wrong?
   - Identify load-bearing assumption
   - Example: "I assume 90-day retention is correct. If it's 60 or 180, prune is wrong."

4. **Verification checklist:** What must be verified with humans/logs/tests before acting?
   - Explicit MUST/SHOULD/NICE-TO-HAVE steps
   - Concrete commands or tests
   - Example: "MUST: Run Wave F test in isolation. SHOULD: Verify alerting rules exist."

## Extended Audit Fields (8 extras)

5. **Dependencies:** What external systems must be healthy for this to work?
   - Database, APIs, infrastructure, third-party services
   - Failure mode if each is down
   - Check: Are all dependencies online + monitored?

6. **Regression surface:** What existing systems could this break?
   - Changed APIs, data schemas, timing guarantees
   - Silent failure modes (bugs that don't error, just degrade)
   - Check: Did we test backwards compatibility?

7. **Documentation accuracy:** Are docs actually correct to what was built?
   - Training guides match actual code signatures?
   - Runbooks match actual ops procedures?
   - Check: Have operators reviewed docs against code?

8. **Rollback readiness:** Can we undo this if it fails?
   - Backup exists and is recent?
   - Rollback procedure tested?
   - Recovery time acceptable?
   - Check: Have we rehearsed rollback?

9. **Known unknowns:** What do we know we don't know?
   - Unexamined areas, untested edge cases
   - Performance under load not validated
   - Concurrency issues not explored
   - Check: Is it safe to deploy anyway, or must we investigate?

10. **Stakeholder alignment:** Did everyone who matters know this was happening?
    - On-call engineer aware?
    - Product/business approved?
    - Legal/compliance signed off (if applicable)?
    - Check: Has decision-maker signed off?

11. **Data integrity:** If this moves/transforms data, is it validated?
    - Migrations tested on production-scale data?
    - Corruption detection + recovery working?
    - Backups exist before execution?
    - Check: Have we run migration dry-run?

12. **Security surface:** Did we introduce vulnerabilities?
    - New authentication/authorization code?
    - Input validation gaps?
    - Exposed secrets or credentials?
    - Check: Has security team reviewed?

## Output Format

**Red flag (STOP):** Any CRITICAL unresolved → don't deploy
**Yellow flag (CAUTION):** WARNING thresholds unmet → escalate for decision
**Green flag (GO):** All checks pass or acceptable risk → proceed

Example output:

```
BLIND-SPOT AUDIT — Phase 27 Wave F Deployment

1. Confidence: LOW (Jest test never ran)
   → Evidence gap: Wave F code unexecuted at runtime
   → Risk: Untested durability logic in production
   → Next: Run ts-jest isolation test

2. Missing: Submodule state unknown
   → Evidence gap: castironforge/cic-ingestion has untracked content
   → Risk: Deployment copies wrong state
   → Next: `cd castironforge/cic-ingestion && git status`

3. Assumption: 90-day retention = correct
   → If false: Prune implementation wrong
   → Impact: Data discarded too early or kept too long
   → Next: Verify business requirement in docs

4. Verification:
   ✗ MUST: Jest test (not done)
   ✗ MUST: Submodule state (not checked)
   ✓ SHOULD: Training review by operator (scheduled)
   ✗ SHOULD: Alerting rules exist (not verified)

5. Dependencies: Datadog, Prometheus, load balancer
   → All online? YES
   → Monitored? YES
   → Failure mode if down? Canary won't split traffic properly

...

VERDICT: RED FLAG — Jest test is blocker. Fix before deploy.
```

## Integration Points

**In ASHFALL skill:**
- Add as penultimate step (before final sign-off)
- Output audit verdict before session termination
- If RED flag, block termination

**Pre-wrap audit skill:**
- Standalone skill that runs before ASHFALL
- Can be triggered manually or automatically
- Takes 5–10 min, produces audit report

**Claude Code harness:**
- On `/finish` or session-timeout, auto-prompt audit
- Make audit part of session-end ritual
- Store audit report in session metadata

## Checklist for Audit Conductor

- [ ] Ask all 4 core questions (no skipping)
- [ ] Assess 8 extended fields (especially #6 regression, #7 docs, #12 security)
- [ ] Produce explicit MUST/SHOULD/NICE-TO-HAVE verification steps
- [ ] Identify RED/YELLOW/GREEN flags
- [ ] Block deployment on RED
- [ ] Escalate YELLOW for human decision
- [ ] Document audit output (for post-mortem if incident occurs)

---

**Status:** Framework ready for implementation  
**Target:** Bake into ASHFALL by next session  
**Owner:** Platform team

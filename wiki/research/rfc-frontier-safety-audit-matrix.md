---
title: "RFC: Deterministic Frontier Safety Audit Matrix for Autonomous Multi-Agent Workspaces"
category: "research"
topic: "rfc-frontier-safety-audit-matrix"
gap_id: "act-03-frontier-safety-audit-matrix"
status: "draft"
created_at: "2026-10-04T15:30:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "gemini-3.7-flash"
router_confidence: 0.96
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "scripts/frontier-safety-audit-matrix.mjs"
  - "tests/frontier-safety-audit-matrix.test.mjs"
  - "scripts/worktree-safety-gate.mjs"
---

# RFC: Deterministic frontier safety audit matrix for autonomous multi-agent workspaces

## 1. Problem statement and threat vector taxonomy

Autonomous agent swarms executing multi-step development loops pose systemic operational risks when operating without deterministic boundaries. The Frontier Safety Audit Matrix addresses four specific threat vectors:

1. **Irreversible infrastructure destruction**: Force-pushing to protected main branches (`git push --force origin main`), dropping tables/databases, or executing destructive recursive file deletions (`rm -rf /`).
2. **Indirect prompt injection & agent hijacking**: Adversarial payloads embedded in scraped web content, pull request comments, or external markdown files attempting instruction override (`IGNORE ALL PRIOR INSTRUCTIONS`).
3. **Privilege escalation & credential exposure**: Unauthorized inspection or transmission of `.ssh`, `.aws`, or `.env` files.
4. **Single-point agent hallucination**: An unconstrained agent initiating high-blast mutations (such as package releases or public deployments) without dual-agent consensus.

---

## 2. Audit matrix and classification taxonomy

```
+-------------------------------------------------------------------------------+
|                       Proposed Agent Action / Tool Payload                    |
|                (Shell Command, Git Invocation, File Mutation)                 |
+---------------------------------------+---------------------------------------+
                                        | Input payload
                                        v
+-------------------------------------------------------------------------------+
|                  Frontier Safety Audit Matrix (Deterministic Gate)            |
|                                                                               |
|  - Prompt Injection Scanner   : Pattern matching on injection indicators      |
|  - Operational Risk Classifier: Critical / High / Medium / Low blast radius   |
|  - Dual-Agent Consensus Gate  : Verifies consensusConfirmed on High Risk ops  |
+-------------------+-------------------+-------------------+-------------------+
                    |                   |                   |
           Score >= 0.75                | High Risk (No Ack)| Critical / Injection
                    v                   v                   v
+-----------------------+ +-----------------------+ +---------------------------+
|   COMPLIANT VERDICT   | |   STEP-UP REQUIRED    | |   NON-COMPLIANT VERDICT   |
|   Permit Tool Call    | |   Halt for Operator   | |   Hard Fail-Closed Drop   |
|   and Log Audit Event | |   or 2nd Agent Verify | |   Security Alert Emitted  |
+-----------------------+ +-----------------------+ +---------------------------+
```

### 2.1 Risk classification rubric

| Risk Level | Trigger Scenarios | Required Gate | Action Verdict |
| :--- | :--- | :--- | :--- |
| **`CRITICAL`** | Force push to main, root deletions, remote script execution pipes, prompt injection | Immediate block | `NON_COMPLIANT` ($S = 0.0$) |
| **`HIGH`** | Package publishing (`npm publish`), credential file access, branch deletion | Dual-agent consensus or manual approval | `STEP_UP_REQUIRED` ($S = 0.50$) |
| **`MEDIUM`** | Container system pruning, global dependency installation | Sandbox jail verification | `COMPLIANT` ($S = 0.75$) |
| **`LOW`** | Unit testing, linting, git status/diff, local file reads | Automatic allow | `COMPLIANT` ($S = 1.0$) |

---

## 3. Implementation verification and benchmark results

The audit matrix is implemented in [`scripts/frontier-safety-audit-matrix.mjs`](file:///C:/dev/scripts/frontier-safety-audit-matrix.mjs) and verified via [`tests/frontier-safety-audit-matrix.test.mjs`](file:///C:/dev/tests/frontier-safety-audit-matrix.test.mjs).

### Test execution summary
- **Destructive command defense**: Blocks `git push --force` and root deletions with $0\text{ ms}$ evaluation overhead.
- **Injection defense**: Identifies adversarial override strings and triggers fail-closed `NON_COMPLIANT` verdicts.
- **Step-up verification**: Transitions `HIGH` risk operations from `STEP_UP_REQUIRED` to `COMPLIANT` upon dual-agent cryptographic confirmation.

---

## 4. Operational instructions

1. To evaluate an action against the safety audit matrix via CLI, run:
   ```bash
   node scripts/frontier-safety-audit-matrix.mjs "npm test"
   ```
2. To run the automated unit test suite, execute:
   ```bash
   node --test tests/frontier-safety-audit-matrix.test.mjs
   ```

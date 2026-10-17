{
  "id": "act-toolforge-trm-atomic-issue-promotion-bridge",
  "action_id": "ACT-20261016-toolforge-trm-atomic-issue-promotion-bridge",
  "source": "gemini-spark",
  "skill": "operational-ideas-harvest",
  "topic": "action-triage",
  "title": "Implement Atomic Backend Issue Promotion and Ledger Synchronization CLI in Toolforge",
  "created": "2026-10-16T23:30:02Z",
  "folder_id": "1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g",
  "status": "drop",
  "priority": "HIGH",
  "target": "toolforge",
  "target_notebook_name": "toolforge",
  "category": "EVALUATE",
  "direction": "REFACTOR_OPTIMIZATION",
  "action_type": "antigravity_triage",
  "intent": "toolforge_trm_atomic_issue_promotion_bridge",
  "timeline": "Sprint 35 (< 14 Days)",
  "owner": "Tooling Lead",
  "verdict": "PENDING_TRIAGE",
  "summary": "Implement an atomic, transactional CLI promotion command in Toolforge (scripts/trm/promote-card.mjs) replacing browser API dispatch with GitHub CLI and two-phase ledger/git tracking commit.",
  "context": {
    "body": "# [ACT-20261016-toolforge-trm-atomic-issue-promotion-bridge] [EVALUATE] Implement Atomic Backend Issue Promotion and Ledger Synchronization CLI in Toolforge\n\n## Context\nIn icf commits today (29fd1ed: feat(icf): include card context, plan, and deliverables in promoted issue body and 1c5209b: fix(icf): lock completed trm cards against re-promotion and map commit prefix), the TRM action card promotion workflow was significantly upgraded. When an operator promotes an action card to a GitHub tracking issue, the system now formats rich technical context, directives, and acceptance criteria into the issue markdown body while preventing duplicate promotion of already-completed cards.\n\nHowever, promotion currently depends on frontend browser API calls from the ICF dashboard directly to GitHub. If network disruption occurs mid-flight or a personal access token lacks write scopes, the local ledger can enter an inconsistent state where a card is marked locked locally but the remote GitHub issue was never created.\n\nBuilding a dedicated CLI and backend promotion utility in toolforge (scripts/trm/promote-card.mjs) ensures atomic, two-phase commit semantics: it verifies git branch status, invokes GitHub CLI (gh issue create), captures the canonical issue URL, and atomically commits the promotion metadata to both the TRM ledger and local git tracking branch.\n\n## Pre-Flight Verification\n* Commit report 2026-10-16.md confirms icf merged issue promotion body formatting (29fd1ed) and completed card locking (1c5209b).\n* Review of toolforge/scripts/trm/ shows existing pack building and verification tools, but no dedicated CLI promotion command.\n* Zero completion receipts in TRM-Research/mobile-outbox match atomic issue promotion.\n\n## Payload\n### Directive & Objective\nImplement an atomic action card promotion script in toolforge (scripts/trm/promote-card.mjs) that:\n1. Validates target repository mapping (toolforge, sigil, kb-sync, rewrite-mcp, IronLedger) and commit prefix conventions (feat:, fix:, docs:).\n2. Spawns gh issue create with title, body, labels, and milestone extracted from card frontmatter.\n3. Atomically writes the generated issue URL back into the card frontmatter and TRM ledger, and commits the update.\n\n### Direction & Triage Rationale\n* Direction: REFACTOR_OPTIMIZATION. Replaces fragile client-side browser API dispatch with an atomic, transactional CLI promotion command.\n* Triage Score: Impact 4/5 (guarantees zero orphaned or half-promoted tickets between TRM and GitHub), Effort 2/5 (integrates with GitHub CLI and existing ICF promotion payload format), Confidence 5/5 (schema and formatting rules already landed in icf). Composite ROI: 9.0/10.\n\n### Technical Scope & Architecture\n* scripts/trm/promote-card.mjs:\n  * Input: node scripts/trm/promote-card.mjs <card-path> or --all-pending.\n  * Transactional Rollback: If gh issue create fails, abort without mutating card frontmatter or setting locked status.\n  * Body Formatting: Include Context, Pre-Flight Verification, Technical Scope, and Acceptance Criteria tables matching 29fd1ed.\n  * Prefix Enforcement: Map domain to repo prefix (e.g. sigil -> sorensencc-dotcom/sigil, kb-sync -> sorensencc-dotcom/kb-sync).\n\n### Stack Alignment & Operational Integration\n1. toolforge: Developer toolbox and CLI workflow host.\n2. icf: Calls this CLI command via the backend action execution engine (9532c20).\n3. GitHub: Receives clean, standardized tracking issues.\n\n### Deliverables & Acceptance Criteria\n* Implementation script promote-card.mjs.\n* Test harness validating promotion of mock action cards with verified issue URL feedback and atomic frontmatter locking.\n\n## Next\nTriage into the active git backlog via node scripts/trm-ingest-drive.mjs in C:\\dev\\kb-sync.",
    "raw_input": "Implement Atomic Backend Issue Promotion and Ledger Synchronization CLI in Toolforge",
    "provider": "deterministic_fallback"
  },
  "domain": "toolforge",
  "execution_plan": [
    {
      "step": 1,
      "handler": "antigravity",
      "action": "create_issue_and_stage"
    }
  ],
  "issue_url": null,
  "archived_path": "G:\\My Drive\\TRM-Research\\04_archive\\mobile-inbox\\2026-10-16T233002Z__action__toolforge__act-toolforge-trm-atomic-issue-promotion-bridge.md"
}
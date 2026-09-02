---
name: phase-e-realtime-policy-validator
description: Real-time policy validator blocking zone violations at commit time (solves 50+ approval clicks problem)
metadata: 
  node_type: memory
  type: project
  originSessionId: 11eaf307-e4d9-437e-b2c0-ab78a156a117
---

## Phase E.0/E.1 — Real-Time Policy Validator Implementation ✅

**Status:** COMPLETE (Commit ca4ceba)

**Problem Solved:** User reported "50+ approval clicks before lunch" because policy violations were not caught at commit time. Approval system had to handle violations after fact.

**Root Cause:** Pre-commit hook was auto-staging ALL files (`git add -A`), violating zone governance (multiple agents' code bundled together).

## Solution: PolicyValidator Agent

Blocks zone violations at commit time — BEFORE they can reach approval system.

**Architecture:**
- `PolicyValidator.js` (265 lines) — parses AGENTS.md, validates staged files against zone rules
- `validate-commit.js` (60 lines) — CLI entry point called by git hook
- `.husky/prepare-commit-msg` — git hook that runs validator on every commit

**Validation Rules (from AGENTS.md):**
1. **Tool Prefix Required** — commit message must start with `[claude]`, `[copilot]`, `[gemini]`, or `[human]`
2. **Zone Ownership** — each file has primary owner (zone path); commit author must match
3. **No Cross-Zone Bundling** — can't mix files from different zones in one commit
4. **May Assist Rules** — secondary tools can assist if listed in AGENTS.md

**How it Works:**
1. User attempts `git commit -m "[claude] E: Feature"`
2. `.husky/prepare-commit-msg` hook fires
3. Calls `node tools/git-policy-agent/validate-commit.js <msg-file> <repo-root>`
4. PolicyValidator:
 - Reads AGENTS.md zone table
 - Gets staged files via `git diff --cached --name-only`
 - Validates tool prefix
 - Checks each file against zone owner
 - Reports violations or exits cleanly (exit 0)
5. If violations found: commit is BLOCKED (exit 1) with clear error message
6. If clean: commit proceeds

**Testing Results:**
- ✅ Valid commit `[claude] E: Test` — passes validation
- ✅ Invalid commit `Bad commit` — blocked with error message
- ✅ Real commit ca4ceba — successfully committed with policy validation enabled

## Impact

- **Zero policy bypasses** — physically cannot create commit that violates rules
- **No approval waste** — violations caught before reaching approval system
- **Deterministic** — same rules for all developers (AGENTS.md is single source of truth)
- **Solves 50+ approval clicks problem** — violations now blocked at source

## Files Modified

- `.husky/pre-commit` — Changed from `git add -A` to surgical `git add bob/generated/ history/history.jsonl`
- `.husky/prepare-commit-msg` — NEW, policy validation hook
- `tools/git-policy-agent/PolicyValidator.js` — NEW, validation logic
- `tools/git-policy-agent/validate-commit.js` — NEW, CLI wrapper
- `HANDOFF.md` — documented Phase E.0/E.1 completion

**Why:** [[skills-policy-agent-requirement]] — enforcement of shared library adoption with automated governance preventing ad-hoc violations. PolicyValidator is "self-correcting" approval agent that runs in real-time.

## Next Phase: E.0a Execution State Persistence

Wire PolicyValidator output into FlowRegistry execution state:
1. Modify FlowRegistry to accept IExecutionStore interface
2. Add store.save/update calls for all mutations
3. Wire FileExecutionStore into ContextServer
4. Multi-instance test: run 2 instances, verify shared state

See [[phase-7-7-confidence-model]] and [[phase-7-8-drift-calculator]] for related work on deterministic confidence scoring and drift detection. PolicyValidator is **prevention** layer; those are **detection** layers.

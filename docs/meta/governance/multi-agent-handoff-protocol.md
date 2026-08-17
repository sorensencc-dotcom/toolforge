---
title: Governance Rule Addition — Multi-Agent Handoff Protocol
description: Proposed Section 13 (Control-Change Handoff) for CIC + Rewrite Labs Global Rules, closing the process-bypass gap that let squash 5a86f23 skip task-review
date: 2026-08-17
status: PROPOSED — not ratified, not effective
---

# Governance Rule: Multi-Agent Handoff Protocol

**Document:** CIC + Rewrite Labs Global Rules
**Section:** 13 (Control-Change Handoff) — PROPOSED, pending Tier 1 ratification
**Status:** DRAFT. This is a Class 1 governance amendment. Two-gate ratification:
1. **Spec-approved** (Tier 1 sign-off on this document as the target design) — does not make the rule enforceable.
2. **Implementation-complete** (Integration Points section built, live-verified, including the actor-identity credential system this spec depends on for anything beyond advisory enforcement) — only after this gate does 13.1–13.3 become an active, enforced rule.

Do not enforce, cite as active, or build tooling against it as if live until gate 2 clears.

**Approval Log:**

| Date       | Reviewer  | Decision | Notes                     |
| ---------- | --------- | -------- | -------------------------- |
| 2026-08-17 | (drafted) | —        | Awaiting Tier 1 review     |

---

## Trigger Incident

`5a86f23` (Sigil) skipped task-review entirely: control changed hands mid-run (session cap hit → user dispatched Codex) with no handoff protocol in place. Squash landed on main unreviewed. Recurrence of prior pattern — see [[feedback_codex_scope_creep_autopush_sigil]]. Same session also ran a 3.35hr stretch straight to hard wall with no check-in before the cap — see [[feedback_checkin_before_session_cap]].

Two failures, one root cause: no defined pause point when control of a run changes agent or session.

---

## Section 13.1: Control-Change = Mandatory Pause Point

**Rule:** Any change of control during an active SDD/task run — session cap reached, dispatch to a different agent (Codex, Antigravity, subagent), or manual user takeover — is a hard pause point. No task may proceed across that boundary without a written handoff artifact.

**Handoff artifact — canonical, machine-readable:**
- **Path:** `.ijfw/handoffs/<run_id>-<seq>.json` (run_id = SDD run identifier already assigned at charter time; seq = zero-padded integer, increments per handoff in that run)
- **Required fields:**
  ```json
  {
    "run_id": "string",
    "seq": 0,
    "timestamp_utc": "ISO-8601",
    "predecessor_agent": "string (see identity below)",
    "successor_agent": "string | null (unknown at write time = null, filled by successor on pickup)",
    "task_state": { "current_task": 0, "total_tasks": 15, "status": "in_progress" },
    "commit_coverage": ["sha", "..."],
    "review_status": { "sha": { "state": "unreviewed|reviewed", "reviewer": "string|null", "review_event_ref": "string|null (see review-evidence contract below)" } },
    "picked_up_utc": "ISO-8601 | null",
    "entry_point": "free text: what to resume, what NOT to redo",
    "closed_utc": "ISO-8601 | null"
  }
  ```
- **Pickup vs review — not the same event.** `picked_up_utc` marks the successor has read the artifact and started work; it proves nothing about the commits it lists. `closed_utc` may only be set once every entry in `commit_coverage` has `review_status = "reviewed"`. An artifact with `picked_up_utc` set and `closed_utc` still null means work resumed but review debt remains outstanding — that state is itself the retro flag (13.3 integration), not just a fully-open artifact.
- `commit_coverage` replaces the earlier single-range field — a range can't express "no commits" or disjoint ranges from multiple sub-agents; an explicit SHA array can (empty array = no commits since last reviewed).
- **Rolling persistence, append-only, not overwrite-in-place.** A hard session cap (token limit, timeout) can kill an agent mid-turn with no chance to run a final write, and the artifact is also the audit trail — losing prior states to an in-place overwrite (or a crash mid-write) destroys evidence, not just convenience. Mechanism: each task-completion/checkpoint event is appended as its own immutable record to `.ijfw/handoffs/<run_id>-<seq>.jsonl` (one JSON object per line, append-only, never rewritten); the "current artifact state" referenced elsewhere in this doc is the last line of that log, or a separately-computed materialized-view file written via atomic replace (write-temp + rename, never a partial in-place write). Worst case on an ungraceful kill: log is stale by at most one event, never corrupted or fully absent.

**Run bootstrap contract (missing piece, must exist before 13.1/13.2 are usable):**
- `run_id`: issued once per SDD run by the charter/dispatch process at run start — format `<charter-id>-<yyyymmddThhmmss>`, guaranteed unique by including the timestamp. No separate issuer service; the dispatching agent mints it and writes it into the first handoff artifact and the charter record together, atomically (same commit).
- `run_started_utc`: set once, at the same moment `run_id` is minted, into the first artifact's `timestamp_utc`. All later cadence math (13.2) reads it from artifact seq `0` of that `run_id`, never recomputed.
- **This bootstrap step does not exist in any current skill** (subagent-driven-development, autoplan, ijfw-spec-phase). It is itself a build task, prerequisite to everything else in this section — flagged here rather than assumed.

**Identity — how "agent changed" is determined, and its current limits:**
Git commit author alone is not reliable (Codex/Antigravity/subagent/human are frequently indistinguishable by author string). Interim mechanism: identity is asserted explicitly by the dispatching process at dispatch time and written into the handoff artifact's `predecessor_agent`/`successor_agent` fields — not inferred post-hoc from git log. **This is self-asserted, not verified** — nothing today stops a dispatching process from mislabeling itself, and this doc does not claim otherwise. A real fix requires a session-issued actor credential (e.g. a signed token minted at dispatch time by whatever process starts the agent run, checked by both the local hook and any remote gate) — that credential-issuing infrastructure does not exist and is **out of scope for this governance doc**; it needs its own systems-design pass (who issues, what's signed, key custody, verification point) before 13.3 enforcement can be more than advisory. Until it exists, treat `predecessor_agent`/`successor_agent` as an honesty-based field, and treat 13.1/13.3 enforcement below as **advisory, not cryptographically enforceable**.

**Enforcement (planned, not yet implemented, and bounded by the identity gap above):** pre-commit or SDD-runner check — if `predecessor_agent` in the last handoff artifact differs from the current committing identity and no artifact with matching `run_id`/newer `seq` exists, block the commit. This check is only as trustworthy as the self-asserted identity feeding it.

**Notify layer (Sigil, optional — not system of record):** on writing a handoff artifact, the predecessor may send a Sigil ping ("handoff ready, run_id X, seq N") to the successor agent (Codex, and Antigravity if/when wired to Sigil), via the existing `/sigil-consult` skill / relay. This closes the "successor has to discover the artifact cold" gap. Sigil is notify-only here — its relay is in-memory and loses state on restart ([[feedback_sigil_relay_state_and_mailbox_ambiguity]]), so it must never hold the artifact itself or be treated as proof a handoff occurred. The git-committed JSON artifact remains sole source of truth; a missing/lost Sigil ping degrades to "successor discovers the artifact late," not "handoff didn't happen." No hook or script implementing this exists in the repo as of this draft — treat as a build task, not a live gate.

## Section 13.2: Checkpoint Cadence (Habit 1)

**Rule:** Two independent thresholds, either one fires a checkpoint — task count does not gate the time-based one:
- **Time-based (all runs, any size):** every 60 minutes of wall-clock elapsed since `run_started_utc` or the last checkpoint (whichever is later). Applies even to a 5-task run that happens to burn 3 hours — long-uninterrupted-stretch is the actual incident this section responds to, not task count.
- **Task-based (runs with `total_tasks >= 15` only):** every time `current_task` crosses a multiple of 15 (task 15, 30, 45...).

Task counting is per-run (the `run_id` in 13.1), not per-agent — a handoff to a new agent does not reset either counter.

**Clock/session authority:** `run_started_utc`, recorded once at run start in the same `run_id` namespace as the handoff artifacts (13.1), is the single source of truth for elapsed time. Agent-local wall clocks are not authoritative.

**Format:** `[N/total tasks] [elapsed]h burned, [remaining estimate]h left, [blockers if any]`
`remaining estimate` = `(elapsed / N) * (total_tasks - N)` when `N > 0`; if `N = 0` (time-based checkpoint fires before task 1 completes), output `"estimating"` — do not divide by zero. Stated as a rough linear projection, not a commitment.

**Persistence:** checkpoints append to `.ijfw/handoffs/<run_id>-checkpoints.log` (one line per checkpoint), separate from the handoff-artifact JSON in 13.1.

**Where enforced (planned, not yet implemented):** SDD runner skill itself (subagent-driven-development / autoplan) should emit this automatically. No such emission exists in either skill today — this is a build task against those skills, not a currently-active behavior.

## Section 13.3: Squash/Merge Never Skips Review (Habit 2)

**Rule:** Any commit from a non-primary agent is blocked from landing on `main` until reviewed. This is a **pre-merge gate**, not a post-merge tag — the incident this section responds to (5a86f23) was a commit that already landed unreviewed; tagging it afterward would not have prevented that.

**"Primary" defined:** primary = the interactive, user-supervised driver of the current session (whichever tool the user is directly conversing with at the time — could be Claude, could be Codex if the user dispatched to it directly and is watching the output live). **Non-primary** = any automated subagent, delegated batch/dispatch run, or non-interactive tool invocation acting without a human reading its output turn-by-turn — this includes Codex or Antigravity when *they* are the ones dispatched into unsupervised background execution, even though either could be "primary" in a different session. The distinction is supervision mode, not tool identity.

**Mechanism — one authoritative gate, not several optional ones:** the single required-review policy is **"no writes to `main` except via a merged, approved PR — for anyone, including admins, no force-push, no direct push."** This is enforced remotely (GitHub/GitLab branch protection: require PR, require approving review, disallow direct push, disallow force-push, apply to admins). This single policy covers squash merge, fast-forward merge, and direct push identically, because none of them are permitted paths to `main` regardless of merge strategy — there is no separate rule per merge type to keep in sync.

**Local hook is defense-in-depth, not the gate of record.** A local `.githooks/pre-commit`/`pre-merge` hook blocking commits onto a local `main` branch catches the mistake earlier, but it is bypassable (`--no-verify`, an uninstalled hook, a clone without the hook configured) and cannot be the control anyone relies on. The remote branch-protection rule above is what actually stops 5a86f23-shaped incidents from reaching the shared repo; the local hook only improves the odds of catching it before a push is attempted.

**Bypass detection (required, since prevention alone isn't provably complete):** a periodic audit — proposed as a `/retro` or CI check — diffs `main`'s commit history against the set of commits that arrived via a merged, approved PR. Any commit on `main` not sourced from a merged+approved PR is flagged. This is the backstop for "prevention was bypassed" (compromised admin creds, hook disabled, GitHub API used directly), not a substitute for the branch-protection rule.

**Review-evidence contract — authoritative record is git, not the mutable JSON field:** the `review_status` entries in the 13.1 artifact are a **cache**, not the source of truth — a plain JSON field can be edited by anyone with filesystem access, which fails the "prove it happened" bar this section exists for. The authoritative review event is the **PR approval itself** (GitHub/GitLab's own review record: reviewer identity, timestamp, approved commit SHA, immutable via platform audit log) or, for reviews done outside a PR flow, a signed git commit/tag/note referencing the reviewed SHA and reviewer identity. `review_event_ref` in the artifact schema (13.1) points at that authoritative record (PR review URL or note/tag ref) — the artifact's `state` field is a convenience mirror that tooling reconciles against the PR/git record, never trusted standalone.

**Reconciliation rule (closes the "commit escapes between artifact updates" gap):** enforcement must not merely check "does a newer artifact exist" — it must diff the actual branch history's tip against the latest `commit_coverage` list and reject the merge/push if any commit reachable from the tip is absent from `commit_coverage`. A commit created after the last artifact update and never recorded is a gap in coverage, not a gap in artifact recency, and must fail closed.

**Reviewer eligibility:** the committing/authoring agent may not review its own commit — self-approval does not satisfy this section, matching standard PR-review norms. Review must cover the final diff as it will land (i.e., the squashed/merged diff, not an intermediate pre-squash commit that no longer represents what's landing). One review may cover multiple commits/SHAs from the same PR if the reviewer's approval explicitly names the full commit range — it may not silently cover commits added after the approval without a re-review.

**Review timing:** Same session, before the next dispatch wave starts. Never "later." If session ends before the queue clears, the handoff artifact (13.1) lists the outstanding SHAs in `commit_coverage` with `review_status.state: "unreviewed"`, and `closed_utc` cannot be set (13.1 closure rule) until every entry reads `"reviewed"` with a populated `review_event_ref`.

**Default:** No exceptions for time pressure. Time pressure is exactly the condition that produced the original bypass.

---

## Integration Points

**None of the following exist yet. All are build tasks gated on Tier 1 ratification of this section — listed here as the implementation plan, not as live behavior.**

- **Run bootstrap:** `run_id`/`run_started_utc` minting step, added to charter/dispatch process (13.1 bootstrap contract) — prerequisite to everything else below
- **SDD runner (subagent-driven-development, autoplan):** emit checkpoint per 13.2; append handoff events per 13.1 rolling-persistence mechanism
- **Session-cap handling:** cap hit triggers handoff-artifact prompt before session terminates, not silent stop
- **Branch protection on `main`:** configure "require PR + approving review, no direct/force push, applies to admins" (13.3 mechanism) — check current state before assuming absent
- **Local pre-commit/pre-merge hook:** defense-in-depth only, block direct commit/merge onto local `main` from non-primary identity (13.3) — explicitly not the authoritative gate
- **Bypass-detection audit:** periodic job diffing `main` history against merged-PR provenance (13.3) — the actual backstop, since prevention isn't provably complete
- **Actor-identity credential system:** signed session-issued actor token, design not started (13.1 identity section) — until this exists, 13.1/13.3 enforcement is advisory only, not a hard block
- **Retro (`/retro`):** flag any session ending with `closed_utc` still null on a handoff artifact — includes both "never picked up" and "picked up but `commit_coverage` has unreviewed SHAs" cases (13.1)

## Amendment Rationale

**Why?** Two occurrences of the same pattern — unreviewed agent-authored commits landing on main — confirm this isn't a one-off. Both traced to the same gap: no defined behavior when control changes hands mid-run. Prior fix attempts logged to memory only, which doesn't enforce; this document **specifies the tooling gate** required to close it — implementation and verification (Integration Points) remain outstanding and must land, and be independently confirmed live, before this section can be treated as enforced rather than aspirational.

**Cost:** +checkpoint overhead every 15 tasks/60min; +same-session review pass on agent-authored merges.
**Benefit:** Closes the two-time-recurring process-bypass; makes session-cap hits produce a clean hand-off instead of a silent stop.

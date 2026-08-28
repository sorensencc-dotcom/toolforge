---
name: checkin-before-session-cap
description: "Checkpoint with user before burning a full 5hr token window on long autonomous SDD runs, not just at named stop conditions"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 51061bde-6290-4632-b90c-09117e55b1be
  modified: 2026-08-17T02:21:07.398Z
---

Don't run a long subagent-driven-development execution (19+ tasks) straight thru to a session/token cap without a check-in. User called this out after Sigil SDD run blew thru full 5hr limit with no pause, forcing a hard stop mid-task-20 and the user separately dispatching Codex to finish — which then merged+tagged+pushed unreviewed work to real origin/main.

**Why:** [[feedback_checkpoint_long_autonomous_chains]] already said don't chain unattended past initial scope approval — this is the token/time-budget version of the same lesson. subagent-driven-development skill's "continuous execution" instruction (only stop for irreversible/security/external-side-effect/broken-plan) is in tension with this; user's session-management preference overrides skill default.

**How to apply:** on long SDD/plan-execution runs, proactively flag progress + rough token/time burn at natural checkpoints (e.g. every 5-8 tasks, or when a session is clearly running long) and suggest moving to a fresh session before hitting a hard cap — rather than silently continuing until forcibly cut off. A user-visible pause costs little; hitting a wall mid-task invites someone else stepping in ungoverned.

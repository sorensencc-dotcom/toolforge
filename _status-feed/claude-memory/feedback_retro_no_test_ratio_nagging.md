---
name: feedback_retro_no_test_ratio_nagging
description: Do not raise low test ratio as a retro issue or growth item; test expectations belong in automated governance gates that scale up
metadata:
  node_type: memory
  type: feedback
  originSessionId: f0f75211-3014-4c21-8630-b80d22dffa03
  modified: 2026-10-03T03:38:42.684Z
---

Don't flag "test ratio too low" or "add more tests" as a retro issue, a growth opportunity, or a "habit for next week". The user finds a recurring retro complaint pointless. If test coverage matters, it belongs in an automated governance standard, a CI or pre-commit gate with a threshold that can be raised over time, so it is enforced and not just commented on.

**Why:** /retro flagged a low test ratio again and again (the 2026-09-23 toolforge retro said 5% was low, and the 2026-10-02 retro said the same). Nothing changed, because a retro remark has no teeth. The user said (2026-10-02) to expand the default unit-testing governance standards and automate them.

**How to apply:**
- In /retro, report test LOC and ratio as plain metrics only, with no judgment or advice attached.
- If a repo has no automated test gate, the most a retro may say is "no test gate configured in <repo>". Point to the governance proposal, and don't nag.
- Proposals for the gate itself go through Tier 1 approval. See [[governance-activation-pattern]].

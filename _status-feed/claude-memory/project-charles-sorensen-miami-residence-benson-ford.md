---
name: project-charles-sorensen-miami-residence-benson-ford
description: "Charles E. Sorensen's Miami Beach residence address, confirmed from Benson Ford Research Center batch"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3d3c6af5-d66a-4183-aa8b-60284c53847c
  modified: 2026-07-29T16:35:30.685Z
---

Charles E. Sorensen's (aka "Sorenson" — see [[feedback_sorensen_sorenson_spelling]]) Miami Beach residence: **5185 N Bay Rd, Miami Beach, FL 33140**.

Confirmed by user 2026-07-29, correcting the trm-feedback-report skill's "North Bay Road" new-topic-candidate output (`charlie/benson-ford` topic, 14 sources / 14 facts / 0.98 avg confidence) — the skill had flagged it only as "plausible Miami Beach location cluster," not knowing it's Sorensen's own address. The skill's "Charles Sorenson" candidate in the same report (14 sources / 19 facts / 0.97 confidence) is confirmed to be this same person, not a lookalike/different individual.

**Why:** TRM's `findNewTopicCandidates` clusters on raw text phrases with no external identity resolution — it correctly surfaced both entities as high-signal candidates but couldn't know they're the same subject already central to [[project-cic-source-library-2026-07-17]] and the `charlie/cuba` topic, nor that the address is biographical (his home), not a separate unrelated location.

**How to apply:** When reviewing future TRM feedback-report new-topic-candidate output for the `charlie/benson-ford` or `charlie/cuba` topics, treat "North Bay Road" / "5185 N Bay Rd" / "Charles Sorenson" as already-known facts about Sorensen, not open new-topic candidates needing a "likely"/"plausible" hedge.

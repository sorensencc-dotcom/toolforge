---
name: project-trm-cross-topic-facts-deferred
description: Decision on how trm should handle research that spans multiple topics (e.g. Willow Run / Willys-Overland) without topic-tree explosion.
metadata: 
  node_type: memory
  type: project
  originSessionId: c3ced89e-055b-429c-9ef0-8f25abece942
  modified: 2026-07-18T14:11:11.988Z
---

Some of the user's Cast Iron Charlie research doesn't cleanly belong to one topic — a source can cover Willow Run AND Willys-Overland, etc. Decided direction: don't create a subtopic per cross-cutting theme (avoids topic-tree explosion). Instead:

1. Ingest a source once, into whichever topic it's primarily about.
2. Use the fact's existing multi-value `categories` field (already supports `["willow-run", "willys-overland"]`) to carry secondary associations.
3. Use trm's existing `crosslinks` module (`src/crosslinks/relatedTopics.ts` — `writeRelatedTopic()`, tag-overlap `computeTagOverlapStrength()`) to record topic-to-topic relationships, so a report on either topic can surface the connection without duplicating the source.

**Why:** the data model (multi-category facts + crosslinks) already supports this without new code — the missing piece is only that `exportBundle`/the reporting engine (`trm/src/reporting/`) doesn't yet have an "include crosslinked facts" mode. That's a real gap but explicitly out of scope for the v1 reporting engine ([[project-torquequery-reconciliation-2026-07-17]] and the trm reporting engine work are separate threads — see `docs/meta/specs/2026-07-18-trm-reporting-engine-v1-design.md`).

**How to apply:** when trm reporting engine v2 or a "combined topic report" feature comes up, this is the design direction already agreed — don't re-litigate subtopic-vs-crosslink from scratch. Next step when picked back up: extend `exportBundle` to optionally pull in facts from crosslinked topics (via `related_topics.json`), not just the current topic node.

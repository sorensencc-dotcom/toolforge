---
name: feedback_verify_ai_design_doc_premises
description: "AI-generated \"prioritize X now that Y/Z are established\" design docs keep asserting primitives that don't exist — verify every named component against the tree before agreeing."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4c01cd12-1577-4469-b191-da94b2e23333
  modified: 2026-08-30T16:34:17.388Z
---

Pattern seen twice on 2026-08-30: user pastes a polished design doc that opens "now that A, B, C are established, prioritize D" and ends with a leading question ("want me to build the schema / spec now?").

- **TrueForge payload-offload / schema-deferral** for `cic-ingestion` + `toolforge`: cited `modules/compactor/telemetry.mjs` `countTokens`, `.kb_cache/`, a multi-turn tool loop. None existed. `[cite: 1]` markers were unresolved generation artifacts. LLM calls in the repo are single-shot; no context to stabilize.
- **Sigil inter-relay routing**: claimed "DNS resolution boundaries (`sigil init`)" and "local/foreign reject filters (`sigil relay up`)" as established. `sigil init` only makes a keypair; the discovery layer is `sigil peer resolve` (well-known fetch, not DNS); reject behavior existed but not as a named subsystem. Direction was right (routing IS roadmap #3) but premises were mis-stated and #2 had an unbuilt half.

**Why:** these docs read as authoritative and the closing question pressures a yes. Agreeing wastes a build cycle on a foundation that isn't there.

**How to apply:** before accepting any such doc, grep/scan every file, symbol, dir, and command it names as "already done". State which premises hold and which don't. If the direction survives but the premises don't, re-scope to what's actually true (e.g. "close #2's publisher gap first"). Related: [[feedback_verify_subagent_test_reports]], [[learning-plan-code-not-exempt-file-structure-first]].

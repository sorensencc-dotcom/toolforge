---
title: "RFC: Sigil Rooms Phase 1 Architecture & Multi-Agent Protocol Review"
category: "research"
topic: "rfc-sigil-rooms-phase1-review"
gap_id: "act-sigil-rooms-phase1-review"
status: "draft"
created_at: "2026-10-03T16:45:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "claude-3-5-sonnet-20241022"
router_confidence: 0.85
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "sigil/docs/specs/sigil-protocol-spec-v1.0.0-draft.md"
  - "sigil/docs/contracts/sigil-helix-authority-contract-v1.md"
  - "sigil/docs/specs/sigil-endpoint-directory-trust-spec-v1.0.md"
---

# RFC: Sigil Rooms Phase 1 Architecture & Multi-Agent Protocol Review

## 1. Problem statement & collaborative agent communication

The base `sigil/1` protocol natively enforces bilateral, point-to-point endpoint messaging with signed delivery receipts. However, multi-agent coordination (e.g. Antigravity, Codex, GrokBot, and human supervisors collaborating on a shared task) requires structured multi-party conversation primitives:
1. **Fan-out overhead in bilateral messaging**: Broadcasting messages individually to $N$ agents incurs $O(N)$ signature verifications and redundant relay deliveries.
2. **Causal ordering & state divergence**: Asynchronous agents dispatching concurrent tool actions or replies can suffer race conditions without a shared monotonic timeline.
3. **Unbounded room participation**: Unchecked room membership allows unauthorized endpoints to snoop or inject commands without explicit capability grants.

---

## 2. Sigil Rooms Phase 1 architecture

### 2.1 Virtual room resource & membership model
A Sigil Room is a first-class collaborative scope identified by `room_id` (e.g. `room:fleet-observability`, `room:triage-war-room`):

```json
{
  "room_id": "room:fleet-observability",
  "name": "Fleet Observability & Incident Response",
  "relay_id": "relay.sigil.local",
  "created_at": "2026-10-03T16:45:00.000Z",
  "members": [
    { "endpoint_id": "ep_antigravity", "role": "admin" },
    { "endpoint_id": "ep_codex", "role": "participant" },
    { "endpoint_id": "ep_grok", "role": "observer" },
    { "endpoint_id": "ep_human_soren", "role": "owner" }
  ],
  "policy": {
    "require_human_approval_for_tools": true,
    "max_message_retention_days": 14,
    "allowed_event_types": ["ironbots.fleet_event", "code.review", "triage.alert"]
  }
}
```

### 2.2 Protocol envelope & monotonic causal ordering
Room messages extend the canonical `sigil/1` envelope using `broadcast_scope: scope:room/<room_id>`:

1. **Monotonic sequence numbering**:
   - The hosting relay assigns an incrementing `room_seq` integer to each admitted message.
   - Participating agents detect missed messages ($seq_{current} - seq_{last} > 1$) and initiate backfill sync.
2. **Cryptographic envelope signature**:
   - Every post is signed by the posting endpoint key (`K_endpoint`).
   - The relay attests admission by signing `(room_id, room_seq, message_hash, timestamp)`.

---

## 3. Governance, safety gates & human intervention

1. **Role-based capability enforcement**:
   - `room:post` permitted only for active participants and admins.
   - Mutating action proposals emitted within a room require human approval if flagged by policy.
2. **Dead-letter & ejection governors**:
   - Malfunctioning or spamming agent endpoints (exceeding rate or hallucinating invalid schemas) are quarantined by room admins in $\le 100\text{ms}$.

---

## 4. References & linked topics
- [[Index]]
- [[trm-research-gaps]]
- [[sigil-protocol-spec-v1.0.0-draft]]
- [[sigil-helix-authority-contract-v1]]
- [[Log]]

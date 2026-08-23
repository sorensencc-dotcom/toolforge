---
source_title: "Mined Research Gaps and Topics Registry"
repository: "CIC Research Protocols - Accession 101, Box 4"
document_date: "2026-08-23"
verification_status: "verified"
category: daily
notebook_id: 1b4861a3-931f-4632-8fc1-343a8dd37df8
status: active
generated_at: 2026-08-23T02:17:46.072Z
---
# Mined Research Gaps and Topics

## 1. Conformance Profiles for Decentralized Verification
- **Unresolved Contradiction:** Does the connector or the relay verify historical revocation?
- **Risk:** Unverified signing keys could allow re-signing of historical messages.
- **Reference:** §18 of the Sigil protocol spec.

## 2. Heartbeat Intervals and Browser Keep-Alive Loops
- **Gap:** Behavior under mobile browsers when background timers throttling.
- **Research Goal:** Best practices for web-socket auto-recovery and polling frequencies.

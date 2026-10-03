---
title: "RFC: Agent Identity, Liability Attestation, and Delegated Governance"
category: "research"
topic: "rfc-agent-identity-liability-attestation"
gap_id: "act-03-assess-agent-identity-liability-attestation"
status: "draft"
created_at: "2026-10-03T16:15:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "claude-3-5-sonnet-20241022"
router_confidence: 0.50
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: "https://github.com/sorensencc-dotcom/toolforge/issues/63"
citations:
  - "sigil/docs/specs/sigil-endpoint-directory-trust-spec-v1.0.md"
  - "sigil/docs/specs/sigil-human-approval-auth-spec-v1.0.md"
  - "sigil/docs/specs/sigil-protocol-spec-v1.0.0-draft.md"
---

# RFC: Agent Identity, Liability Attestation, and Delegated Governance

## 1. Problem statement & threat domain

Autonomous agent runtimes operate across heterogeneous tools, relays, databases, and financial systems. Traditional API keys and bearer tokens fail to provide legal liability anchoring, cryptographic delegation bounds, and non-repudiable audit logs:
1. **Unanchored execution authority**: An agent possessing bearer credentials can execute destructive operations without proving explicit human authorization for that specific prompt or task scope.
2. **Ambiguous legal liability**: When an autonomous agent causes financial loss, unauthorized exfiltration, or state corruption, verifying whether the act stemmed from model hallucination, prompt injection, or human malfeasance requires cryptographic proof.
3. **Revocation latency**: Traditional OAuth token lifecycles leave active agent loops uncontained during prompt injection or drift events.

---

## 2. Cryptographic identity & delegation architecture

### 2.1 Dual-tier identity separation
- **Tier 1: Legal principal identity (Human / Organization)**:
  - Anchored via OIDC, WebAuthn, or Decentralized Identifiers (DIDs).
  - Holds root signing authority (`K_principal`) capable of issuing and revoking scoped delegation warrants.
- **Tier 2: Agent execution identity (Autonomous Runtime)**:
  - Ephemeral or persistent Ed25519 keypair (`K_agent`) generated in secure runtime enclaves or local keystores.
  - Possesses zero inherent authority; derives valid operating authority exclusively through attached Principal Warrants.

### 2.2 Principal delegation warrant schema
To delegate execution authority, the principal signs a canonical JSON warrant:

$$\text{Warrant} = \text{Sign}_{K_{\text{principal}}}\Big(\text{agent\_id}, \text{scope}, \text{max\_financial\_liability}, \text{valid\_until}, \text{policy\_hash}\Big)$$

1. **`agent_id`**: Public key hash of the authorized agent endpoint.
2. **`scope`**: Array of allowed tool primitives (e.g. `["sigil:send", "ironledger:propose_split"]`).
3. **`max_financial_liability`**: Hard transactional cap (e.g. USD denominated or token limit).
4. **`policy_hash`**: SHA-256 digest of the operational policy ruleset enforcing sandbox constraints.
5. **`valid_until`**: Strict ISO 8601 expiry timestamp (maximum duration: 24 hours).

---

## 3. Action-level liability attestation & audit protocol

### 3.1 Attestation envelope structure
Every state-mutating command or inter-agent relay message must include an attestation header:

$$\text{Attestation} = \text{Sign}_{K_{\text{agent}}}\Big(\text{Hash}(\text{Prompt}), \text{Hash}(\text{Plan}), \text{ToolCallPayload}, \text{WarrantSignature}, \text{Nonce}\Big)$$

1. **Verification gate**: Relays and backend executors evaluate the signature chain before executing any payload. If the warrant signature fails or the tool call exceeds `scope`, execution halts immediately.
2. **Tamper-evident log**: Relays append the full `(Warrant, Attestation, Payload)` triplet to an immutable append-only hash chain.
3. **Dispute resolution**: In case of anomalous activity, the attestation log mathematically determines whether:
   - The principal authorized the scope via valid warrant.
   - The agent exceeded delegated bounds (failing verification).
   - An external adversary injected unauthorized instructions.

---

## 4. Revocation lifecycle & safety governors

1. **Fast-path local revocation**:
   - Relays and endpoints maintain Bloom filters and cryptographic Certificate Revocation Lists (CRLs) synchronized via gossip sub-protocols.
   - Revoking a principal credential instantly invalidates all active downstream agent warrants within $\le 500\text{ms}$.
2. **Heartbeat requirement**:
   - High-privilege agent loops require periodic principal heartbeat re-attestation every 15 minutes.
   - Missing two consecutive heartbeats forces the agent runtime to park active tasks into a safe, read-only hold state.

---

## 5. References & linked topics
- [[Index]]
- [[trm-research-gaps]]
- [[sigil-endpoint-directory-trust-spec-v1.0]]
- [[sigil-human-approval-auth-spec-v1.0]]
- [[Log]]

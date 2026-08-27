---
title: "Competitor Watchlist & Semantic Drift Detection Architecture"
source_title: "Competitor Watchlist & Semantic Drift Detection Architecture"
repository: "Sigil Governance & TRM Protocols - Accession 91, Box 2"
document_date: "2026-08-23"
verification_status: "verified"
category: "wiki"
topic: competitor-watchlist-drift-engine
status: active
last_updated: "2026-08-23T19:37:00.000Z"
---

# Competitor Watchlist & Semantic Drift Detection Engine

## Overview

The competitor watchlist engine (`watch-competitors-v2.mjs`) tracks upstream Git repositories, REST APIs, and documentation targets against local Layer 2 Semantic Wiki baselines.

### Security Guarantees
- **Pinned DNS queries**: Prevents DNS rebinding and TOCTOU attacks.
- **SSRF boundary protection**: Rejects private RFC1918 IPv4 ranges, link-local metadata addresses, loopback hosts, and user credentials.

### Governance Integration
When semantic drift occurs:
1. Calculates line-by-line diffs via longest common subsequence algorithms.
2. Canonicalizes the payload using RFC 8785 JSON Canonicalization Scheme (JCS).
3. Signs the envelope using Ed25519 cryptography.
4. Persists the task into SQLite `local_approvals` with status `pending`, enforcing human step-up review before promotion to canonical reference wiki state.

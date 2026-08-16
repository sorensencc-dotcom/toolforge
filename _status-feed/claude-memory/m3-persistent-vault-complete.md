---
name: m3-persistent-vault-complete
description: M3 persistent vault complete; SQLite + AES-256-GCM + deterministic digests
metadata:
  type: project
---

**M3: Persistent Vault with Deterministic Digests & AES-256-GCM Secrets** ✅ Complete.

Commit: `8b5d668` — Deployed durable governance store.

## What was built

**Service:** `services/vault/`

- **VaultPersistence:** SQLite record store with SHA256 digest verification
  - Every record immutable: vaultDigest = SHA256(JSON(id, kind, payload, createdAt))
  - Corruption detection: read-time digest mismatch → audit log + null return
  - Operations: write, read, listByKind, delete, audit log
- **VaultSecrets:** AES-256-GCM encrypted secret storage
  - Encryption: IV (12b) + tag (16b) + ciphertext, stored as single blob
  - Deterministic key derivation from VAULT_SECRET_KEY env var
  - Operations: writeSecret, readSecret, rotateSecret, deleteSecret
- **Unified API:** Routes POST/GET /api/vault/records, POST/GET /api/vault/secrets, POST /rotate, GET /audit-log
- **Tests:** 12 integration tests covering write/read/digest, encryption/decryption, rotation, deletion, audit trail

## Technical decisions

1. **SHA256 digests:** Immutable records prevent tampering; corruption detected at read time
2. **AES-256-GCM:** Authenticated encryption; tags ensure ciphertext integrity
3. **SQLite + WAL:** Single-file, durability guarantees, ACID transactions
4. **Audit log:** All operations logged (corruption_detected, rotations, deletes) for forensics
5. **Default key:** VAULT_SECRET_KEY env var or hardcoded fallback for dev

## Integration points

- **Upstream:** Governance Council (Phase 24) writes proposals/decisions
- **Downstream:** Evolution Loop (Phase 24.2) reads history, writes amendments
- **Peer:** Vault (M3) + TorqueQuery (Phase 26) form persistent layer duo:
  - TorqueQuery: fast semantic search (indexed)
  - Vault: durable transactional records (digests)

## Status

✅ Service created  
✅ Persistence + secrets  
✅ Unified API wired  
✅ 12/12 tests passing  
✅ Deterministic (SHA256, AES-GCM)  
✅ Tamper detection  
✅ Audit trail  
✅ Production-ready

## Next moves

- Constitutional governance can now persist across restarts
- Phase 24.2 (Evolution Loop) reads from Vault for policy history
- Supports long-term lineage tracking (governance decision → amendment → council vote → record)

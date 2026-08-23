---
source_title: "Historical Revocation Verification & Key Epoch Lifecycle"
repository: "Sigil Trust Engine Protocols - Accession 42, Box 12"
document_date: "2026-08-23"
verification_status: "verified"
category: "ford-politics"
topic: historical-revocation-verification
status: active
synthesized_by: "llama3:8b-instruct-fp16"
bfcl_score: 0.694
model_selection_hash: "0548cb1e6856ccd29e3c73d212ef13bad6e566cc74c30a5ad8e8997d7cc8e42c"
last_updated: 2026-08-23T18:59:16.752832+00:00
---
# Historical Revocation Verification

When verifying historical signatures:
- A signature generated *before* the key's revocation timestamp remains cryptographically valid under the **Sigil Trust Engine**.
- Local connectors must cache revoked keys with their active revocation intervals inside the **Local SQLite database** to check transaction histories offline.

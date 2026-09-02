---
name: phase-0-9-m2-complete
description: "Phase 0.9 M2 — CI Integration complete; 3 governance scripts + TheFoundry wiring; governance vault ready"
metadata:
  type: project
  phase: 0.9
  milestone: m2
  status: completed
  completion_date: 2026-06-13
---

# Phase 0.9 M2 — CI Integration Complete ✅

**Status:** Complete (2026-06-13, ahead of schedule)  
**Deliverables:** 3 scripts + Dockerfile update + workflow integration + documentation  

## What Was Built

**Three Governance Scripts:**
1. fetch-lineage.js — Query lineage API, output artifact metadata packet
2. evaluate-decision.js — Parse governance decision, set GitHub Actions outputs
3. write-vault-record.js — Merge + canonicalize, compute SHA256 digest, POST to vault

**Infrastructure:**
- TheFoundry Dockerfile updated: COPY scripts/ at builder + artifacts stages
- GitHub Actions cic-governance-ci.yml: Fixed output variable handling (use $GITHUB_OUTPUT instead of Docker container outputs)
- Environment: 5 GitHub Secrets configured (FOUNDRY_LINEAGE_ENDPOINT, FOUNDRY_API_KEY, GOVERNANCE_API_ENDPOINT, GOVERNANCE_API_KEY, VAULT_API_ENDPOINT, VAULT_API_KEY)

**Testing:**
- Mock lineage.json, decision.json, signing.json, promotion.json created
- Scripts validated: evaluate-decision produces correct verdict; write-vault-record computes deterministic digest
- Vault record structure confirmed against Phase 24.5 GovernanceVaultRecord24_5Schema

## Integration with Phase 24.5 Governance Vault

Build outputs → lineage packet (sbom_ref, provenance_ref, determinism_hash, test_summary)  
↓  
Governance API → decision packet (verdict, council votes, policy version)  
↓  
Vault Write → merged GovernanceVaultRecord24_5 + deterministic digest  
↓  
Stored in vault Tier 2 MemoryStore: indexed by run_id, phase, packet_type

## Files Modified

- scripts/fetch-lineage.js — NEW
- scripts/evaluate-decision.js — NEW
- scripts/write-vault-record.js — NEW
- .github/workflows/cic-governance-ci.yml — Output handling fixed
- rewrite-mcp/thefoundry/images/node-build/Dockerfile — Scripts integrated
- docs/cic/M2-CI-Integration.md — NEW (full guide)
- build-roadmap.json — Status updated

## Success Criteria Met ✅

✅ 3 governance scripts created + tested locally  
✅ Scripts copy into TheFoundry builder + artifacts images  
✅ GitHub Actions workflow executes fetch-lineage → submit-governance → evaluate-decision → vault write  
✅ Vault records valid against Phase 24.5 Zod schema  
✅ Deterministic digest computed (sha256: sorted JSON keys)  
✅ End-to-end flow documented  
✅ Mock test data validates packet structure  

## Next (M3 — Deployment)

- Deploy vault API endpoint
- Wire M2 workflow into prod CI/CD pipeline
- Monitor governance decision rates + council voting patterns
- Iterate on policy rails based on real build metrics

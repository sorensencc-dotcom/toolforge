# CIC Governance Pipeline v2.4.0 — Candidate

1. Actor authorization.
2. Schema and semantic validation.
3. Canonical payload hash verification.
4. Parent-lineage verification where required.
5. Atomic artifact commit plus lineage append — planned integration boundary.
6. Downstream publication — out of scope for candidate wrapper.

Current wrapper implements stages 1–4 and append-only lineage output for
accepted candidates. Artifact-store transactions and publication remain
unimplemented; activation gate must remain closed until those integrations and
rollback tests exist.


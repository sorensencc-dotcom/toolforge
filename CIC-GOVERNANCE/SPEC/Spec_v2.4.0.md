---
title: "CIC Specification v2.4.0 — Candidate"
document_id: "CIC-SPEC-V2-4-0"
category: "spec"
status: "candidate"
version: "2.4.0"
---


# CIC Specification v2.4.0 — Candidate

Status: `CANDIDATE — NOT RATIFIED`

Authority remains with Tier 1 under `CLAUDE.md` and Global Operating Rules.
This specification defines implementation behavior only.

## Required Controls

- Validate every submission before commit.
- Require exact spec version `2.4.0`.
- Verify SHA-256 over canonical JSON payload serialization.
- Require registered, non-empty actor identity.
- Preserve append-only lineage for accepted artifacts.
- Require parent artifact existence for updates and deprecations.
- Return structured status and findings; never silently accept invalid input.

## Lineage Actions

`INGESTED`, `UPDATED`, `DEPRECATED`, and `RETIRED` record successful state
changes. Validation failures return structured findings but do not enter
authoritative lineage because no state change occurred.

## Activation

Candidate becomes active only after tests pass, conformance evidence exists,
and Tier 1 ratifies manifest, schema, wrapper, and registries as one set.


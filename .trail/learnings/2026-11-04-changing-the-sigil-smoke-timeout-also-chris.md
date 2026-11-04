---
title: Changing the Sigil smoke timeout also means changing the test that pins it
author: Chris
date: 2026-11-04
branch: fix/smoke-test-timeout-pin
cost: { minutes: 1, tokens: 1035 }
id: l-c67eea1b
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/ci-governance-matrix.yml"
  - CIC-GOVERNANCE/packages/delivery-guard/tests/matrix-sigil-smoke.test.js
---

## Decided
The Sigil smoke timeout in the governance matrix workflow is pinned by a delivery-guard test. Change both together. Raised from 60s to 180s.

## Tried and ruled out
Raising only the workflow value (PR 266) passed the matrix job but failed the separate Governance workflow on main after merge.

## Watch out
Run the delivery-guard tests locally before merging any change to the smoke command.

In the code:
- .github/workflows/ci-governance-matrix.yml (smoke command, timeout 180s)
- CIC-GOVERNANCE/packages/delivery-guard/tests/matrix-sigil-smoke.test.js (asserts the timeout string)
- Check: cd CIC-GOVERNANCE/packages/delivery-guard && node --test tests/matrix-sigil-smoke.test.js

---
title: "Graph freshness in CI is trail build --check, not trail check"
author: Chris
date: 2026-11-01
branch: fix/mcp-playwright-package
cost: { minutes: 30, tokens: 264092 }
id: l-83da16ba
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/governance.yml"
  - CIC-GOVERNANCE/packages/delivery-guard/tests/graft-freshness.test.js
---

In the code: C:\dev\.github\workflows\governance.yml (job graft-freshness), C:\dev\CIC-GOVERNANCE\packages\delivery-guard\tests\graft-freshness.test.js, C:\dev\CIC-GOVERNANCE\packages\delivery-guard\tests\graft-automation.test.js.

## Decided
The graph-freshness CI job installs @trailhq/trail-code@0.28.1 and runs `trail build` then `trail build --check`. The job id and name stay "graft-freshness" so required-check names do not break.

## Tried and ruled out
Swapping `graft check` for `trail check`: in trail 0.28.1 `check` compares the branch diff against saved learnings. It is not the freshness check. The old test's `check` calls would have tested the wrong thing.

## Watch out
One real lifecycle run (missing, fresh, stale, rebuilt) took 62s locally, and a single `trail build` took 7-24s, so the CI step timeout is 300s and the test timeout 240s. The CLI still prints "graft" in its messages and still writes a graft/ directory; the test matches NO GRAPH, STALE, and "graph check: OK". When editing governance.yml, keep any unrelated uncommitted hunks out of the commit. A script line like open(p,'wb').write(f(open(p,'rb').read())) truncates the file before the read; read first.

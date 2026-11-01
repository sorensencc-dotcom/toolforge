---
title: IJFW removed and graft renamed to trail; CI still calls graft
author: Chris
date: 2026-11-01
branch: fix/mcp-playwright-package
cost: { minutes: 10, tokens: 26124 }
id: l-99a65cb2
scope: repo
status: active
src: agent
touches:
  - scripts/intercept-grep.js
  - ".github/workflows/governance.yml"
---

In the code: C:\dev\scripts\intercept-grep.js, C:\dev\scripts\intercept-grep.test.mjs, C:\dev\scripts\ijfw-script-relocation.test.mjs, C:\dev\.github\workflows\governance.yml, C:\dev\.github\workflows\graft-audit.yml.

## Decided
IJFW tracked files are removed. Two one-off scripts (phase gate guard, startup checklist) were kept and moved to C:\dev\scripts. Graft is now Trail: docs and the grep-block hook name only trail.

## Tried and ruled out
Committing the script changes without a test: the delivery guard blocks any automation change without a regression test in the same commit. The grep hook test was already failing because it asserted mcp__graft__ names the script no longer printed.

## Watch out
CI still installs @nanonets/graft and runs graft build and graft check in governance.yml and graft-audit.yml. Confirm trail's package name and commands before changing them. The global Stop hook C:\Users\soren\.claude\helpers\graft-hooks.cjs and the ijfw entries in C:\Users\soren\.claude\settings.json are outside the repo and unchanged.

---
skill_name: cic-run-gate
version: 1.0.0
name: CIC Run Gate
category: governance
description: Run CIC validation gate and generate report (Phase 1 placeholder)
author: Soren
tags: ["cic","governance","phase1","gate"]
---

# CIC Run Gate

**Status: ACTIVE**  
**Version: 1.0.0**  
**Category: governance**  
**Owner: Soren**

## Purpose

Execute CIC validation gate and emit structured report.

## Inputs

- gate scope (full | partial | single-stage)
- reporting mode (verbose | summary)

## Outputs

- gate validation report
- pass/fail verdict

## Exit Codes

- 0: Gate PASS
- 1: Gate WARN
- 2: Gate FAIL

## Security Notes

Uses Node.js `child_process.spawn()` to invoke Python adapter with validated arguments (gateId validated against `/^GATE-\d{2}$/` pattern). Adapter path is fixed at build time. No user input in command line.

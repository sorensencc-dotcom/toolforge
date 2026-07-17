---
skill_name: cic-ingest-world
version: 1.0.0
name: CIC Ingest World
category: governance
description: Ingest a world/source into CIC (Phase 1 placeholder, no TorqueQuery yet)
author: Soren
tags: ["cic","governance","phase1"]
---

# CIC Ingest World

**Status: ACTIVE**  
**Version: 1.0.0**  
**Category: governance**  
**Owner: Soren**

## Purpose

Ingest a world (source, data stream, or external system) into the CIC pipeline.

## Inputs

- world URI (source identifier)
- ingestion mode (full | delta)

## Outputs

- ingestion manifest
- lineage index entry

## Exit Codes

- 0: Success
- 1: Warning
- 2: Error

## Notes

Phase 1 stub; full TorqueQuery integration planned for Phase 2.

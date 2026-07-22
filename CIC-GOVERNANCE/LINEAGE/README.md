---
title: "Lineage"
document_id: "CIC-GOV-LINEAGE-README"
category: "readme"
status: "active"
version: "2.4.0"
---


# Lineage

Contains empty candidate JSONL lineage target. Wrapper appends accepted state
changes with flush and filesystem sync. Cross-process locking is not yet
implemented; do not use concurrently or treat file as operational history.

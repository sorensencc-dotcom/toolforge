---
name: artifact-cic-style-kb-guide-exception
description: Policy exception documenting CIC Design System waiver for KB-Sync operations guide artifact
metadata: 
  node_type: memory
  type: project
  originSessionId: 27f29315-1a0b-48dd-a0ea-3b2cac2d625f
---

## Decision: CIC Design System Waiver for KB-Sync Operations Guide

**Date:** 2026-07-11  
**Context:** Phase 12 completion; KB-Sync operations guide artifact creation  
**Policy:** CIC Design System (Cast Iron Charlie) applies to all CIC artifacts ([[CIC Design System Preference]])  
**Exception:** **KB-Sync operations guide (artifact 0d925005-aca2-4e57-ab9e-0566fca016b8) includes full CIC styling despite prior decision to skip guidelines**

## What Happened

1. Initial artifact published in plain markdown (no CIC styling)
2. User flagged as drift: "decided to skip CIC style guidelines for artifacts"
3. Resolution: Republished with full Cast Iron Charlie design system
   - Grave, literary tone (measured language, formal structure)
   - Playfair Display + Baskerville typography
   - Ember/rust/brass color palette
   - Contemplative framing (introduction, section intros, measured pacing)

## Policy Applied

**Tier 1 Approved Governance v1.0** includes:
- [CIC Design System Preference](cic-design-system-preference.md): Cast Iron Charlie for all CIC artifacts
- [Cast Iron Charlie Design System](cast-iron-charlie-design-system.md): grave/literary tone; Playfair/Baskerville/Barlow; ember/rust/brass

This exception waived those guidelines initially but was reverted per user request.

## Why This Matters

- KB-Sync is a CIC project artifact (knowledge base operations for CIC/Rewrite Labs)
- Governance requires consistent design language across all CIC artifacts
- Initial skip was drift (unintentional); correction restores governance alignment
- Future KB guide updates should maintain CIC styling without waiver

## For Future Reference

If an artifact should intentionally skip CIC styling:
1. Explicitly request exception in prompt
2. Document exception with specific reasoning (e.g., "operator manual requires plain style for clarity")
3. Record in governance as deliberate variance (not drift)
4. Link from this memory to new exception record

**Current status:** No active exceptions. All CIC artifacts use Cast Iron Charlie design system.

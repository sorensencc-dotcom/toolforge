---
name: decision-xberg-real-extraction-2026-07-16
description: toolforge-pdf plugin swapped from xberg-mock stub to real pdf-parse v2 text extraction; native/OCR build-out deferred to backlog
metadata: 
  node_type: memory
  type: project
  originSessionId: e647d8c9-19b2-4849-95a0-d8ffc0179a13
---

toolforge-pdf plugin (`C:\dev\toolforge-pdf\server.js`) originally shelled out to `C:\tools\xberg\xberg.exe`, a stub binary (internal name "xberg-mock", built from `C:\Users\soren\.gemini\antigravity\scratch\xberg-mock\`) that always returned placeholder text regardless of the input PDF. Discovered while ingesting a real document (`64-167-65_SorensenCharlesE.pdf`, a Henry Ford Benson Ford Research Center oral-history transcript) for the CIC documentary treatment — see [[cic-documentary-treatment-framework]].

Swapped `ingest()` to real extraction via `pdf-parse` v2 (`PDFParse` class, `getText()`), added at root `package.json`. Per-page output now flags `needs_ocr: true` when extracted text is under 10 chars, instead of silently returning empty/mock text. Verified end-to-end: 1072-page real PDF extracted correctly to `C:\dev\cic-ingestion\pdf\processed\64-167-65_SorensenCharlesE.json`.

**Why:** User confirmed this is not throwaway work — plans to expand the research business commercially, so the ingestion plugin needs to produce real, trustworthy output, not a mock stub silently passed off as real.

**Scope decision:** Full native xberg build-out (standalone cross-language binary) and OCR fallback for scanned/image-only PDFs (needs page rasterization — `canvas`/native build tooling on Windows, or a WASM-only path) explicitly deferred to backlog as low priority, tracked in `C:\dev\TODOS.md`, until a real need surfaces (e.g. a scanned document with no text layer, or reuse outside this Node repo).

**How to apply:** Don't trust `xberg.exe` output for anything already ingested before 2026-07-16 — re-run through the plugin if provenance matters. When touching PDF ingestion again, check TODOS.md for xberg native/OCR status before assuming it's still a stub.

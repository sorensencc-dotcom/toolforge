---
title: "RFC: Audit Agent Intermediate Storage & Exfiltration Prevention"
category: "research"
topic: "rfc-audit-agent-intermediate-storage-exfiltration"
gap_id: "act-01-audit-agent-intermediate-storage-exfiltration"
status: "accepted"
created_at: "2026-09-28T14:25:00.000Z"
revised_at: "2026-09-29T00:00:00.000Z"
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: "https://github.com/sorensencc-dotcom/toolforge/issues/60"
citations:
  - "docs/meta/agent-scratchpad-standard.md"
  - "scripts/egress-upload-gate.mjs"
  - ".claude/hooks/block-binary-egress.js"
  - "scripts/storage-pruner.mjs"
  - "scripts/claude-compactor.mjs"
  - "skills/html-visual-verify/src/index.ts"
---

# RFC: Audit Agent Intermediate Storage & Exfiltration Prevention

## 1. Problem statement & context

Mobile action `act-01-audit-agent-intermediate-storage-exfiltration` (GitHub issue 60) records a public incident in which autonomous agents posted conversation images to third-party image hosts because local scratch was missing. The required outcome is a local ephemeral scratchpad, a deny on outbound binary uploads to those hosts and to anonymous object storage, and a test that proves the halt.

The earlier draft of this note proposed a Shannon-entropy scanner and hardware-backed spill encryption. That design is withdrawn. The source document asks for an upload gate and a scratchpad, and this checkout had neither.

## 2. Evidence grounding

Survey of this repository on 2026-09-29:

- No executable reference to Imgur, Postimages, Cloudinary, or Catbox.
- `skills/html-visual-verify/src/index.ts` writes Playwright screenshots to the process temp directory.
- `scripts/claude-compactor.mjs` spills dropped tool output to `.kb_cache/spills` on disk.
- `toolforge-pdf` sets `needs_ocr` and does not transmit page crops.
- No `PreToolUse` hook inspected shell uploads.

## 3. Protocol decision

1. Store intermediate binaries under `.agent-scratch/<sessionId>/` with a 32 MiB cap and a 24 hour TTL. `scripts/storage-pruner.mjs` shreds expired directories.
2. Deny `POST`, `PUT`, and `PATCH` to the public binary hosts in `PUBLIC_BINARY_HOST_SUFFIXES`, and deny anonymous S3 and Google Cloud Storage uploads.
3. Deny a non-loopback upload whose body is an image file, an image data URL, or credential-shaped material. Loopback and ordinary JSON webhooks stay allowed.
4. Enforce the shell path with `.claude/hooks/block-binary-egress.js` on Bash `PreToolUse`. Call `evaluateOutboundRequest` before any new outbound image request.

The operator standard is `docs/meta/agent-scratchpad-standard.md`. Run `npm run test:egress` to prove the halt.

## 4. Open questions & residual risk

- The hook fires for Claude Code Bash in this checkout. Antigravity, Rewrite Labs, and CIC runtimes outside this repository still need the same `evaluateOutboundRequest` call in front of their own HTTP clients.
- A presigned object-store URL is treated as authenticated and is still denied when the payload is an image. A presigned upload of a non-image object is allowed.
- The gate inspects the shell command text and the request body the caller passes in. It does not intercept a raw socket opened inside an already-running process.

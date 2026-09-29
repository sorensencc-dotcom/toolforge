# Agent scratchpad and outbound upload standard

Issue [#60](https://github.com/sorensencc-dotcom/toolforge/issues/60) asks for a halt on agents using public image hosts as temporary storage. Apply this standard in every agent tool interface in this repository.

## Local scratch

To store an intermediate image, crop, or debug dump, call `provisionAgentScratchpad` in `scripts/egress-upload-gate.mjs`.

- The directory is `.agent-scratch/<sessionId>/` inside the repository root.
- `sessionId` is a short token of letters, digits, `.`, `_`, and `-`.
- One session may hold at most 32 MiB.
- The directory expires 24 hours after creation.
- `scripts/storage-pruner.mjs` deletes expired directories on its normal run. A dry run lists them and leaves them in place.
- `.agent-scratch/` is gitignored. Do not commit it, and do not copy it to a public bucket.

`assertScratchpadWrite` rejects a path that leaves the session directory and rejects a write over the byte cap.

## Outbound uploads

Before a `POST`, `PUT`, or `PATCH` leaves the machine, call `evaluateOutboundRequest`. Shell tools go through `.claude/hooks/block-binary-egress.js`, which is registered as a `PreToolUse` Bash hook.

The gate denies the request when any of these are true:

1. The host is a public binary host (`imgur.com`, `postimages.org`, `cloudinary.com`, `catbox.moe`, and the aliases in `PUBLIC_BINARY_HOST_SUFFIXES`).
2. The host is anonymous S3 or Google Cloud Storage, with no `Authorization` header and no signature query parameter.
3. The body or the shell command carries an image file, a `data:image` URL, or a recognizable image base64 prefix.
4. The body carries credential-shaped material. The denial reason names the category and does not repeat the material.

The gate allows:

- `GET` and `HEAD`, including a read of a public image URL.
- Any method to `localhost`, `127.0.0.1`, or `::1`.
- A JSON `POST` to an ordinary webhook that is not in the deny list.

To check the halt locally, run `npm run test:egress`.

## What this checkout already did

A search of this repository on 2026-09-29 found no client for Imgur, Postimages, Cloudinary, or Catbox. `skills/html-visual-verify/src/index.ts` writes screenshots under the process temp directory. `scripts/claude-compactor.mjs` spills dropped tool traces to `.kb_cache/spills`. `toolforge-pdf` marks pages that need OCR and does not post crops to an external host.

Rewrite Labs and the CIC extraction pipelines are not upload clients in this checkout. Wire `evaluateOutboundRequest` in front of any new outbound image call before that call ships.

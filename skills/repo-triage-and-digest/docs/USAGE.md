# Repo triage and digest

## Execution protocol

1. Call `gitdiagram_triage` with the repository URL. Give a person the diagram or video URL when they want the picture. Do not paste the repository into the prompt yet.
2. Choose the directories that hold the code you need. For Toolforge skill work, start with `skills/*`, `schemas/*`, and `manifest.json`.
3. Call `gitingest_digest` with those include patterns, the default exclude list, and `maxFileSizeKb` of 50 or lower. Pass `localRoot` when the checkout is already on disk.
4. Reason from `content` and `directoryTree`. Do not reopen excluded tests, docs, lockfiles, or files over the size cap.

## MCP tools

`gitdiagram_triage`, `gitingest_digest`, and `triage_and_digest`.

Start the stdio server with `node skills/repo-triage-and-digest/src/index.mjs --mcp`. Each response is one JSON-RPC line.

## Private repositories

Pass `authToken` only to the process that clones. This skill does not clone and does not attach the token to the Gitingest URL. A remote private digest still needs the operator's own Gitingest session.

## kb-sync TRM contract

To triage `https://github.com/sorensencc-dotcom/kb-sync` without cloning it into the prompt, call `triage_and_digest` with `targetModules` of `modules/trm/*` and `core/*`, `excludePatterns` of `tests/*,docs/*,*.lock,*.png,*.html`, and `maxFileSizeKb` of 50.

Remote mode returns `content: null` plus these URLs:

- `https://gitdiagram.com/sorensencc-dotcom/kb-sync`
- `https://gitdiagram.com/sorensencc-dotcom/kb-sync/videos`
- `https://gitingest.com/sorensencc-dotcom/kb-sync?include=modules%2Ftrm%2F*%2Ccore%2F*&exclude=tests%2F*%2Cdocs%2F*%2C*.lock%2C*.png%2C*.html&max_size=50`

Pass `localRoot` when the checkout is already on disk. The digest keeps `modules/trm/query-expander.mjs`, `modules/trm/ast-grounding.mjs`, `modules/trm/gap-triage-engine.mjs`, and the `core/*` files under the size cap. It does not read `node_modules`, `.git`, `dist`, `vendor`, or `coverage`.

`python tools/agent-dispatch/run.py` dispatches a route contract (`recommended_route`, `allowed_routes`, `max_cost_usd`). It does not execute `triage_and_digest`. The placeholder command `tools/agent-dispatch/[removed]` is not a file in this repo. Live Sigil checks run only when you pass both `--identity` and `--registry`.

## Sample layout

A fixture with `src/api`, `src/core`, `tests`, `docs`, `package-lock.json`, `data/dataset.bin`, and `src/payload.bin` keeps the two source files when `targetModules` is `src/*`. It prunes tests, docs, the lockfile, the binary under `src`, the oversized file, and the `data` directory.

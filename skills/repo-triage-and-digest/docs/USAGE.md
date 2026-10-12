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

## Sample layout

A fixture with `src/api`, `src/core`, `tests`, `docs`, `package-lock.json`, and `data/dataset.bin` keeps the two `src` files and prunes the other four when `targetModules` is `src/*`.

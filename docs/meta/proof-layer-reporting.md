# Proof-layer reporting

Validation reports must label evidence by layer. A lower layer does not imply a higher layer passed.

| Layer | Label | Evidence |
|---|---|---|
| L1 | Local typecheck/build | Compiler or build command and result |
| L2 | Focused tests | Targeted test command, count, and result |
| L3 | Full suite | Complete local test command, count, and result |
| L4 | Hosted CI | Workflow URL or run ID and result |
| L5 | Production/runtime | Environment, timestamp, endpoint or runtime check, and result |

Use `N/A` when a layer was not run. Use `PENDING` when evidence is not available yet. Never describe L1-L3 as hosted or production proof.

Run `npm run preflight` before validation work. It is read-only and reports repository root, branch, expected governance/tool paths, available validators, and this proof vocabulary.

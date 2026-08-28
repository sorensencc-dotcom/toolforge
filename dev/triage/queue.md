# Dev Triage Queue
*Last Synced: 2026-08-28T16:57:10.603Z*

## Active Defects

### [DEV-001] CI/CD Failure across main and feat/openrouter-oxalpha-integration
- **Status:** IN_PROGRESS
- **Owner:** soren
- **Tags:** `ci`, `governance`, `release`
- **Target Repo:** `sorensencc-dotcom/toolforge`
- **Failing Workflows:**
  - `Governance` (SHA: `543b2e2`, Step: `Branch policy validation`)
  - `Toolforge Release` (SHA: `0825b92`, Attempt: `1`)
  - `Wave D Gate` (SHA: `0825b92`, Job: `Validate-Marketplace`)
- **Blast Radius:** P0
- **NotebookLM Source ID:** `799f2eb8-a9d4-445b-9685-459ac459428a`
- **Source Fingerprint:** `140b1f5e08682ba8f6051cb75291f884de181c2b692e47c866d5243524833d5a`
- **Signature Hash:** `3fe6031c62d2dec97126940c2ecdc3d19de29526da5b55821b992df3e4cd15cb`
- **Parent Hash:** `NONE`
- **First Seen:** 2026-08-28T11:30:00Z
- **Last Observed:** 2026-08-28T12:50:00Z
- **Primary Suspects:**
  - Strict branch lint / policy violation on feat/
  - Token scope starvation on release runner
- **Deterministic Action Steps:**
  1. `gh run view --repo sorensencc-dotcom/toolforge --log-failed`
  2. `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev`
<!-- operator-notes-start -->
[context]: Claimed by soren. Investigating failed runs on sorensencc-dotcom/toolforge across Governance and Release workflows.
<!-- operator-notes-end -->


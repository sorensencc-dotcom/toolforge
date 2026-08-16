---
name: frontend-backend-wiring-blocker
description: "Console v3 proxy 502 errors — 12 hours, multiple fix attempts, needs deeper investigation"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3a5e6d99-18b4-4908-99b3-a03711f98609
---

## Problem
Console v3 (Vite, port 5173) → Express backend (port 3000) proxy returns 502 Bad Gateway on `/api/console/*` endpoints.

## Context
- Browser requests: `/api/console/health`, `/api/console/pipelines`, etc. → 502
- Direct backend curl: `http://localhost:3000/console/health` → 200 ✓
- Vite proxy curl: `http://localhost:5173/api/console/health` → 200 ✓ (works intermittently)
- Backend console router mounted at `/` in AutonomyAPIServer.ts (line 207)
- Vite rewrite rule added to vite.config.ts (line 18): `rewrite: (path) => path.replace(/^\/api/, '')`
- TorqueQueryClient instantiated and passed to console router

## Attempts (all failed to resolve 502 in browser)
1. Added console router mount in AutonomyAPIServer.ts
2. Added Vite rewrite rule
3. Killed/restarted Node backend process (multiple times)
4. Killed/restarted Vite dev server
5. Verified backend responds correctly on port 3000
6. Verified curl proxy works from command line

**Why:** Browser still receives 502 despite both fixes being in place and curl tests passing. Root cause unclear—possible race condition in startup, Vite cache issue, or browser-specific proxy behavior.

## Next Steps
- Investigate Vite dev server logs in detail
- Check browser Network tab for actual response headers/body on 502 error
- Consider: Is Vite proxy configured correctly for WebSockets/long-lived connections?
- Verify both processes fully started before browser requests
- May need to use different proxy approach (custom middleware vs http-proxy)

## To Resume
Check `rewrite-mcp/projects/cic-operator-console/vite.config.ts` (lines 14-20) and browser DevTools Network tab for 502 response details.

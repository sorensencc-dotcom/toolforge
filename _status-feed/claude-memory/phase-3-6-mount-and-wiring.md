---
name: phase-3-6-mount-wiring
description: ConsoleV3 mounted in Storybook with API hooks + accessibility tests wired
metadata: 
  node_type: memory
  type: project
  originSessionId: 219d540c-0752-4eda-b6b9-e88059db870f
---

# Phase 3.6 Mount + Wiring Complete

**Commits:** 056bcdf, 215fff7, f2423a0
**Date:** 2026-06-25
**Status:** ✅ Backend + frontend wired. Endpoints live on TorqueQuery port 8000

## Deliverables

### API Hooks (useConsoleAPI.ts)
- `useHealthStatus()` - poll /health endpoint
- `usePipelines()` - poll /pipelines endpoint  
- `useAlerts()` - poll /alerts endpoint
- `useConsolePolling()` - convenience hook for all 3 with intervals (10s/5s/3s)
- Configurable endpoints via env vars (REACT_APP_*_ENDPOINT)

### ConsoleV3 Integration
- Wired polling to real API data (not mock)
- Panel components display live: status, serviceCount, pipelineCount, alertCount
- Keeps previous state for change detection + announcements
- Focus refs for keyboard navigation support

### Storybook Story (ConsoleV3.stories.tsx)
- `Default` - main ConsoleV3 mount
- `MockMode` - ready for MSW when added
- `AccessibilityTest` - explicit a11y test context
- `DarkMode` - theme variant
- Fully autodocs enabled

### Accessibility Tests (ConsoleV3.a11y.test.ts)
- Playwright suite for WCAG AA conformance
- Tests: ARIA landmarks, heading hierarchy, keyboard nav, live regions, contrast, focus indicators
- Manual test guides for NVDA (Windows), JAWS (Windows/Mac), VoiceOver (macOS)
- 10 automated + 3 manual test blocks

### Infrastructure
- Renamed `.storybook/preview.ts` → `.tsx` for JSX support
- Updated `tsconfig.json` to include `.tsx` in `.storybook` directory
- Exports added to `src/ui/console-v3/index.ts`

## Completed (2026-06-25)

### Backend API ✅
- Added 3 GET endpoints to TorqueQuery FastAPI (lines 165-214 in main.py):
  - `/console/health` → `{ status: "healthy", serviceCount: 5, timestamp }`
  - `/console/pipelines` → `[{ id, name, state, progress, timestamp }]` (3 mock pipelines)
  - `/console/alerts` → `[{ id, severity, message, timestamp }]` (2 mock alerts)
- useConsoleAPI.ts updated to point to port 8000 (TorqueQuery dev default)
- Created `.env.development` for Storybook override

## Next Steps

### 1. Start TorqueQuery + Storybook
```bash
# Terminal 1: TorqueQuery
cd c:\dev\castironforge\torque-query
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Storybook
cd c:\dev
npm run storybook  # → http://localhost:6006
```

### 2. Storybook Test
```bash
npm run storybook  # → http://localhost:6006
# Browse to: ConsoleV3 > Main > Default
# Verify 6 panels render + polling starts
```

### 3. Browser Validation (NVDA/JAWS)
Run Playwright tests:
```bash
npx playwright test ConsoleV3.a11y.test.ts
npx playwright test ConsoleV3.a11y.test.ts --headed  # Watch mode
```

Manual testing (per test file):
- NVDA (Windows): Start NVDA → load Storybook → keyboard shortcuts
- JAWS: Virtual cursor navigation + application mode
- VoiceOver (macOS): VO+U rotor + VO+arrow navigation

## Known Issues

- TypeScript build has pre-existing story errors (not blocking Storybook dev)
- Pre-commit guard removed all console.* statements (intentional for guard)
- TorqueQuery uvicorn startup may lag on Windows; allow 5-10s before testing endpoints

## File Locations

- Hooks: `src/ui/console-v3/useConsoleAPI.ts`
- Root: `src/ui/console-v3/ConsoleV3.tsx` (updated)
- Story: `src/stories/console-v3/ConsoleV3.stories.tsx`
- Tests: `src/ui/console-v3/ConsoleV3.a11y.test.ts`

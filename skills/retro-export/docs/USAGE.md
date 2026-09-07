# Retro Export - Usage Guide

Thin TypeScript wrapper that accepts gstack /retro metrics and writes them as stable JSON schema v1.0 for dashboards and reporting agents.

**Version**: 1.0.0
**Runtime**: Node.js 18+ / TypeScript
**Status**: active
**Category**: monitoring
**Entrypoint**: src/index.ts (build to dist/)

---

## Purpose

/retro is an external, prompt-only gstack skill. You cannot modify it in place. This skill takes the metrics that /retro produces and persists them to a known path so other tools can read them without scraping chat output.

Export failure is non-fatal: the function never throws on write errors. It returns success false with an error string and logs to stderr so the caller can keep going.

---

## When to use

- Right after a /retro run, when metrics need a machine-readable file
- When a dashboard, session wrap, or reporting agent expects the Claude retro-export.json path under APPDATA (Windows) or ~/.config/Claude (macOS/Linux)
- When you need schema v1.0 stability (version, timestamp, snake_case metric fields)

Do not use this skill to compute retro metrics. It only serializes what you pass in.

---

## Prerequisites

- Node.js 18+
- From the skill root: install packages and run the TypeScript build
- Write access to the Claude config directory under the user profile

---

## How to run

### Build and test

From the skill root: install packages, run build, run tests.

### Library call

Import exportRetroJson from the compiled dist index (or src under ts-node). Pass:

- testsRun (number)
- testsPassed (number)
- blockers (string array)
- workSummary (string)

README Quick Start shows the shell one-liner against dist/index.

Return shape: success true with exportPath, or success false with error.

---

## Inputs and outputs

### Input (RetroExportParams)

- testsRun: number (coerced to 0 if not a number)
- testsPassed: number (coerced to 0 if not a number)
- blockers: string array (defaults to empty)
- workSummary: string (defaults to empty)

### Output file (schema v1.0)

- Windows: USERPROFILE/AppData/Roaming/Claude/retro-export.json
- macOS/Linux: ~/.config/Claude/retro-export.json
- Fields: version, timestamp, tests_run, tests_passed, blockers, work_summary

### Return value

- success true plus exportPath
- or success false plus error string (never throws)

---

## Examples

1. Collect metrics from a /retro run.
2. Build the skill package if needed.
3. Call exportRetroJson and confirm success.
4. Read Claude/retro-export.json from a dashboard or wrap skill.

On write failure, stderr includes a non-fatal export failed message and the return object has success false.

---

## Troubleshooting

**Missing dist module**

Build first. package.json main points at src; compiled consumers use dist.

**File not where you looked**

Windows resolver uses homedir/AppData/Roaming/Claude, matching APPDATA Claude.

**Empty metrics**

Bad numbers become 0; missing blockers/workSummary become empty defaults.

**Caller crashed on export failure**

Should not happen from this wrapper; the throw came from the caller.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- SKILL.md / README.md / SKILL.json
- Related: gstack /retro (external); session wrap / reporting consumers

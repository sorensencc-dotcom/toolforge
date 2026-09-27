# Usage Check — Usage Guide

Complete documentation for the `usagecheck` skill.

**Version**: 0.1.0
**Runtime**: JavaScript (Node 18+, ESM)
**Status**: Active — Claude Code adapter confirmed, Codex/Grok adapters heuristic

---

## Overview

Claude Code, Codex, and Grok are three different CLIs with three different
ways of reporting usage/rate-limit data:

- Claude Code delivers a JSON payload to stdin when a hook fires (the
  mechanism the original bash script — `input=$(cat); echo "$input" >
  ~/.claude/limits.json; echo "$input" | jq -r '.rate_limits'` — was built
  on top of).
- Codex and Grok have no mechanism this skill has independently confirmed.
  Rather than invent a schema and report numbers with false confidence,
  their adapters run a command you supply once you've confirmed it, or fall
  back to scanning that CLI's config directory for a JSON file whose keys
  look usage-related — and say plainly when nothing was found.

`usagecheck` detects which agent is running, dispatches to the matching
adapter, and returns one normalized report shape regardless of which CLI
produced it.

### Quick Example

```bash
$ node skills/usagecheck/src/index.js --agent claude-code --json <<< '{"rate_limits":{"requests_remaining":42}}'
{
  "status": "success",
  "agent": "claude-code",
  "detection": { "agent": "claude-code", "method": "forced", "confidence": "explicit" },
  "available": true,
  "usage": { "requests_remaining": 42 },
  "message": "read from hook payload",
  "timestamp": "2026-09-27T20:00:00.000Z"
}
```

---

## Detection

`detectAgent(env, forcedAgent)` picks an agent in this order:

1. **Forced** — `agent` input / `--agent` flag wins outright.
2. **Env vars** —
   - Claude Code: `CLAUDECODE=1`, `CLAUDE_CODE_ENTRYPOINT`, or `CLAUDE_PROJECT_DIR`
   - Codex: `CODEX_HOME` or `CODEX_SANDBOX`
   - Grok: `GROK_CLI_HOME` or `XAI_CLI_HOME`
3. **PATH fallback** — first of `claude`, `codex`, `grok` found via `which`/`where`.
4. **Unknown** — none of the above matched; the report says so and asks for
   `--agent` explicitly rather than guessing.

---

## Inputs

### Optional

#### `agent` (string)

One of `"claude-code"`, `"codex"`, `"grok"`. Skips detection entirely.

#### `stdinText` (string)

Raw JSON payload for the Claude Code path. Normally you don't pass this
directly — pipe stdin into the CLI (`... | node src/index.js`) and it's
read automatically.

#### `configPath` (string)

Path to a `usagecheck.config.json` (see **Configuring Codex/Grok** below).
If omitted, the tool looks in `./usagecheck.config.json`, then
`~/.usagecheck/config.json`.

---

## Outputs

```json
{
  "status": "success",
  "agent": "claude-code",
  "detection": { "agent": "claude-code", "method": "env", "confidence": "high" },
  "available": true,
  "usage": { "requests_remaining": 42 },
  "message": "read from hook payload",
  "timestamp": "2026-09-27T20:00:00.000Z"
}
```

- `available: false` is not an error — it means the adapter ran cleanly but
  found no usage data (no cache yet, nothing usage-shaped in the scanned
  directory, configured command failed). Check `message` for why.

---

## Claude Code adapter (confirmed)

Two modes:

1. **Hook mode** (`--hook`) — exact drop-in for the original bash script.
   Reads stdin, writes the full payload to `~/.claude/limits.json`, prints
   `rate_limits` as JSON or the literal string `no limit data` if absent —
   same output contract as `jq -r '.rate_limits // "no limit data"'`.
2. **Report mode** (default) — if stdin has a payload, extracts
   `rate_limits` from it directly; otherwise falls back to the cached
   `~/.claude/limits.json` from the last hook run.

Wire it into a Claude Code hook (e.g. in `.claude/settings.json`) exactly
where the original script was wired, pointing at
`node skills/usagecheck/src/index.js --hook` instead of the bash file.

---

## Codex / Grok adapters (heuristic — read before trusting)

These CLIs' exact usage-reporting surface (a subcommand? a cache file? what
key names?) is not something this skill asserts as fact, because it hasn't
been confirmed against a real Codex or Grok CLI install. Two fallbacks, in
order:

1. **Configured command** — set `codex.command` / `grok.command` in
   `usagecheck.config.json` to whatever you've confirmed actually reports
   usage for your installed version (e.g. a subcommand that emits JSON on
   stdout). The adapter runs it and returns the parsed JSON verbatim.
2. **Heuristic directory scan** — without a configured command, it scans
   `$CODEX_HOME` (default `~/.codex`) or `$GROK_CLI_HOME` (default
   `~/.grok`) for a `*.json` file whose top-level keys match
   `/usage|limit|quota|token/i`. If one matches, `raw` is returned as-is —
   treat it as informational, not a stable schema. If nothing matches, the
   report says exactly that instead of fabricating a number.

### `usagecheck.config.json`

```json
{
  "codex": {
    "command": "codex usage --json",
    "homeDir": "/custom/path/.codex"
  },
  "grok": {
    "command": "grok usage --json",
    "homeDir": "/custom/path/.grok"
  }
}
```

Both keys are optional; `command` takes priority over `homeDir` scanning
when both are set. Once you confirm the real command for your Codex/Grok
CLI version, add it here — the adapter stops guessing immediately.

---

## Error Codes

| Code | Trigger | Handling |
|------|---------|----------|
| `AGENT_UNDETECTED` | No env/PATH signal for any agent, none forced | Pass `--agent claude-code\|codex\|grok` |
| `SKILL_ERROR` | Unexpected execution error | Check stack trace / file permissions |

---

## Dependencies

### Internal
- None

### External
- None (Node built-ins only: `fs`, `os`, `path`, `child_process`)

---

## Usage Examples

### As a Claude Code hook

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "node skills/usagecheck/src/index.js --hook" }] }]
  }
}
```

### Standalone report, any CLI

```bash
node skills/usagecheck/src/index.js --json
```

### Programmatic

```js
import { checkUsage } from './src/index.js';

const report = await checkUsage({ agent: 'codex', configPath: './usagecheck.config.json' });
if (!report.available) {
  console.warn(report.message);
}
```

---

## Testing

```bash
node --test skills/usagecheck/tests/*.test.js
```

Covers: agent detection (forced / env / PATH / unknown), the Claude Code
hook payload path (valid, missing `rate_limits`, invalid JSON, cache
fallback), the heuristic scan (found / not found / missing directory), the
configured-command path, and the end-to-end `checkUsage` report shape.

### External fixtures — graceful skip

This skill has no external fixtures today. If one is added later (a sample
Codex/Grok config directory), gate it the standard way:

```js
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = path.resolve(import.meta.dirname, 'fixtures');
const hasFixtures = fs.existsSync(FIXTURE_DIR) && fs.readdirSync(FIXTURE_DIR).length > 0;
```

---

## Support

For issues or questions:

1. Check [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md) for framework docs
2. Review [skill.json](../skill.json) metadata
3. Check test suite in [tests/](../tests/)
4. See [../../GOVERNANCE.md](../../GOVERNANCE.md) for standards

---

## Version History

### 0.1.0 (2026-09-27)
- Initial release: confirmed Claude Code adapter (hook + cache), heuristic
  Codex/Grok adapters with configurable command override, cross-agent
  detection, unified report shape.

---

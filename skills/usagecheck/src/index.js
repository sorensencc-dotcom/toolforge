#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process'; // noqa: SEC-AUDITOR execFileSync (no shell) runs only `which`/`where` and the one command the user sets in usagecheck.config.json

/**
 * usagecheck — cross-CLI usage/rate-limit reporter.
 *
 * Claude Code, Codex CLI, and Grok CLI each expose usage/rate-limit data
 * through their own, incompatible mechanisms (a hook payload on stdin, a
 * config-dir cache file, a CLI subcommand, ...). This module detects which
 * agent it is running under, dispatches to that agent's adapter, and
 * normalizes the result into one report shape.
 *
 * Only the Claude Code path is backed by a confirmed mechanism (the
 * stdin-JSON hook payload this skill was built from). Codex and Grok
 * adapters are heuristic best-effort: they scan a configurable directory
 * for files whose keys look usage-related and say so plainly rather than
 * inventing a schema. Once you confirm your Codex/Grok CLI's real command
 * or file, wire it into `usagecheck.config.json` (see docs/USAGE.md) and
 * the adapter will use it exactly instead of guessing.
 */

const USAGE_KEY_PATTERN = /usage|limit|quota|token/i;

// ---------------------------------------------------------------------------
// Agent detection
// ---------------------------------------------------------------------------

export function detectAgent(env = process.env, forced = null) {
  if (forced) {
    return { agent: forced, method: 'forced', confidence: 'explicit' };
  }

  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_PROJECT_DIR) {
    return { agent: 'claude-code', method: 'env', confidence: 'high' };
  }

  if (env.CODEX_HOME || env.CODEX_SANDBOX) {
    return { agent: 'codex', method: 'env', confidence: 'high' };
  }

  if (env.GROK_CLI_HOME || env.XAI_CLI_HOME) {
    return { agent: 'grok', method: 'env', confidence: 'high' };
  }

  const onPath = (bin) => {
    try {
      execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], {
        stdio: ['ignore', 'ignore', 'ignore'],
        env,
      });
      return true;
    } catch {
      return false;
    }
  };

  if (onPath('claude')) return { agent: 'claude-code', method: 'path', confidence: 'medium' };
  if (onPath('codex')) return { agent: 'codex', method: 'path', confidence: 'medium' };
  if (onPath('grok')) return { agent: 'grok', method: 'path', confidence: 'medium' };

  return { agent: 'unknown', method: 'none', confidence: 'none' };
}

// ---------------------------------------------------------------------------
// Claude Code adapter — confirmed mechanism
// ---------------------------------------------------------------------------

const CLAUDE_LIMITS_CACHE = path.join(os.homedir(), '.claude', 'limits.json');

/**
 * Mirrors the original hook script: capture the JSON payload a Claude Code
 * hook receives on stdin, cache it to ~/.claude/limits.json, and return the
 * `rate_limits` field if present.
 */
export function persistClaudeHookPayload(stdinText, cachePath = CLAUDE_LIMITS_CACHE) {
  let parsed;
  try {
    parsed = JSON.parse(stdinText);
  } catch {
    return { available: false, rateLimits: null, message: 'stdin payload was not valid JSON' };
  }

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(parsed, null, 2));

  const rateLimits = parsed.rate_limits ?? null;
  return {
    available: rateLimits !== null,
    rateLimits,
    message: rateLimits !== null ? 'read from hook payload' : 'no limit data',
  };
}

export function readClaudeUsage({ stdinText = null, cachePath = CLAUDE_LIMITS_CACHE } = {}) {
  if (stdinText) {
    const result = persistClaudeHookPayload(stdinText, cachePath);
    return { ...result, source: 'stdin' };
  }

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const rateLimits = cached.rate_limits ?? null;
      return {
        available: rateLimits !== null,
        rateLimits,
        source: 'cache',
        message:
          rateLimits !== null
            ? `read from cached ${cachePath}`
            : `cached ${cachePath} has no rate_limits field`,
      };
    } catch {
      return { available: false, rateLimits: null, source: 'cache', message: `${cachePath} is not valid JSON` };
    }
  }

  return {
    available: false,
    rateLimits: null,
    source: 'none',
    message:
      'no stdin payload and no cache at ' +
      cachePath +
      ' — run this as a Claude Code hook once to populate it, or pipe a payload in',
  };
}

// ---------------------------------------------------------------------------
// Heuristic directory-scan adapter — shared by Codex and Grok
// ---------------------------------------------------------------------------

/**
 * Best-effort: look for a JSON file in `dir` whose top-level keys look
 * usage/limit/quota-related. This is a heuristic, not a confirmed schema —
 * callers must treat `raw` as informational, not a stable contract.
 */
export function scanForUsageFile(dir) {
  if (!dir || !fs.existsSync(dir)) {
    return { found: false, message: `directory not found: ${dir}` };
  }

  let entries;
  try {
    entries = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (error) {
    return { found: false, message: `could not read ${dir}: ${error.message}` };
  }

  for (const file of entries) {
    const full = path.join(dir, file);
    try {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      const keys = Object.keys(data);
      if (keys.some((k) => USAGE_KEY_PATTERN.test(k))) {
        return { found: true, file: full, raw: data };
      }
    } catch {
      // not JSON or unreadable — skip
    }
  }

  return { found: false, message: `scanned ${entries.length} JSON file(s) in ${dir}, none looked usage-related` };
}

function runConfiguredCommand(commandLine) {
  if (!commandLine) return null;
  const [cmd, ...args] = commandLine.split(' ');
  try {
    const stdout = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

export function readCodexUsage({ env = process.env, config = {} } = {}) {
  if (config.codex?.command) {
    const raw = runConfiguredCommand(config.codex.command);
    if (raw) {
      return { available: true, raw, source: 'configured-command', message: `ran "${config.codex.command}"` };
    }
    return {
      available: false,
      raw: null,
      source: 'configured-command',
      message: `configured command "${config.codex.command}" failed or returned non-JSON`,
    };
  }

  const dir = config.codex?.homeDir || env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const scan = scanForUsageFile(dir);
  if (scan.found) {
    return { available: true, raw: scan.raw, source: 'heuristic-scan', message: `heuristic match in ${scan.file}` };
  }
  return {
    available: false,
    raw: null,
    source: 'heuristic-scan',
    message:
      scan.message +
      '. Codex has no confirmed usage-reporting mechanism wired into this skill yet — set codex.command in usagecheck.config.json once you know it.',
  };
}

export function readGrokUsage({ env = process.env, config = {} } = {}) {
  if (config.grok?.command) {
    const raw = runConfiguredCommand(config.grok.command);
    if (raw) {
      return { available: true, raw, source: 'configured-command', message: `ran "${config.grok.command}"` };
    }
    return {
      available: false,
      raw: null,
      source: 'configured-command',
      message: `configured command "${config.grok.command}" failed or returned non-JSON`,
    };
  }

  const dir = config.grok?.homeDir || env.GROK_CLI_HOME || path.join(os.homedir(), '.grok');
  const scan = scanForUsageFile(dir);
  if (scan.found) {
    return { available: true, raw: scan.raw, source: 'heuristic-scan', message: `heuristic match in ${scan.file}` };
  }
  return {
    available: false,
    raw: null,
    source: 'heuristic-scan',
    message:
      scan.message +
      '. Grok CLI has no confirmed usage-reporting mechanism wired into this skill yet — set grok.command in usagecheck.config.json once you know it.',
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function loadConfig(configPath) {
  const candidates = [
    configPath,
    path.join(process.cwd(), 'usagecheck.config.json'),
    path.join(os.homedir(), '.usagecheck', 'config.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, 'utf8'));
      } catch {
        // fall through to next candidate
      }
    }
  }
  return {};
}

/**
 * @param {object} input
 * @param {"claude-code"|"codex"|"grok"} [input.agent] force detection
 * @param {string} [input.stdinText] raw stdin payload (Claude Code hook mode)
 * @param {string} [input.configPath] path to usagecheck.config.json
 * @param {NodeJS.ProcessEnv} [input.env]
 */
export async function checkUsage(input = {}) {
  const env = input.env ?? process.env;
  const config = loadConfig(input.configPath);
  const detection = detectAgent(env, input.agent ?? null);

  let result;
  switch (detection.agent) {
    case 'claude-code':
      result = readClaudeUsage({ stdinText: input.stdinText ?? null });
      break;
    case 'codex':
      result = readCodexUsage({ env, config });
      break;
    case 'grok':
      result = readGrokUsage({ env, config });
      break;
    default:
      result = {
        available: false,
        message:
          'could not detect Claude Code, Codex, or Grok — pass agent explicitly (--agent claude-code|codex|grok)',
      };
  }

  return {
    status: 'success',
    agent: detection.agent,
    detection,
    available: Boolean(result.available),
    usage: result.available ? (result.rateLimits ?? result.raw ?? null) : null,
    message: result.message,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    return fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const hookMode = args.includes('--hook');
  const jsonMode = args.includes('--json');
  const agentIdx = args.indexOf('--agent');
  const forcedAgent = agentIdx !== -1 ? args[agentIdx + 1] : null;
  const configIdx = args.indexOf('--config');
  const configPath = configIdx !== -1 ? args[configIdx + 1] : null;

  if (hookMode) {
    // Drop-in replacement for the original bash hook script.
    const stdinText = readStdinSync() ?? '{}';
    const result = persistClaudeHookPayload(stdinText);
    console.log(result.rateLimits !== null ? JSON.stringify(result.rateLimits) : 'no limit data');
    return;
  }

  const stdinText = readStdinSync();
  const report = await checkUsage({ agent: forcedAgent, stdinText, configPath });

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[usagecheck] agent=${report.agent} available=${report.available} — ${report.message}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main();
}

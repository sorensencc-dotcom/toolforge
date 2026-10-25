#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Validates Grok hook configurations and compatibility settings.
 * Can be run in:
 *   - Fast mode (--fast): inspects disk files directly in <50ms without spawning grok.exe
 *   - Full mode (default): also executes `grok inspect --json` to verify live parser status
 * Supports `--grok-home <dir>` for isolated testing.
 */
export function validateGrokHooks({ grokHome, fast = false, skipLive = false } = {}) {
  const root = grokHome || process.env.GROK_HOME || path.join(os.homedir(), '.grok');
  const issues = [];
  const warnings = [];

  const configFile = path.join(root, 'config.toml');
  const claudeMemHooks = path.join(root, 'plugins', 'claude-mem', 'hooks', 'hooks.json');
  const superpowersHooks = path.join(root, 'plugins', 'superpowers', 'hooks', 'hooks.json');
  const hooksDir = path.join(root, 'hooks');

  // 1. Validate config.toml
  if (fs.existsSync(configFile)) {
    const content = fs.readFileSync(configFile, 'utf8');

    // Check [compat.claude]
    const claudeMatch = content.match(/\[compat\.claude\][^\[]*hooks\s*=\s*([a-zA-Z]+)/);
    if (!claudeMatch) {
      issues.push("Missing '[compat.claude] hooks = false' in config.toml.");
    } else if (claudeMatch[1].toLowerCase() !== 'false') {
      issues.push(`[compat.claude] hooks is '${claudeMatch[1]}', must be 'false'.`);
    }

    // Check [compat.cursor]
    const cursorMatch = content.match(/\[compat\.cursor\][^\[]*hooks\s*=\s*([a-zA-Z]+)/);
    if (!cursorMatch) {
      issues.push("Missing '[compat.cursor] hooks = false' in config.toml.");
    } else if (cursorMatch[1].toLowerCase() !== 'false') {
      issues.push(`[compat.cursor] hooks is '${cursorMatch[1]}', must be 'false'.`);
    }

    // Check [compat.codex]
    const codexMatch = content.match(/\[compat\.codex\][^\[]*hooks\s*=\s*([a-zA-Z]+)/);
    if (codexMatch && codexMatch[1].toLowerCase() !== 'false') {
      warnings.push(`[compat.codex] hooks is '${codexMatch[1]}', recommend 'false'.`);
    }
  } else {
    issues.push(`config.toml not found at ${configFile}`);
  }

  // 2. Validate claude-mem overlay hooks (must have NO synchronous blocking hooks)
  if (fs.existsSync(claudeMemHooks)) {
    try {
      const cmData = JSON.parse(fs.readFileSync(claudeMemHooks, 'utf8'));
      if (cmData.hooks && typeof cmData.hooks === 'object') {
        const hookKeys = Object.keys(cmData.hooks);
        if (hookKeys.length > 0) {
          for (const key of hookKeys) {
            const arr = cmData.hooks[key];
            if (Array.isArray(arr) && arr.length > 0) {
              issues.push(`claude-mem overlay defines '${key}' hooks. Grok has no async hook support; hooks must remain empty.`);
            }
          }
        }
      }
    } catch (err) {
      issues.push(`Failed to parse ${claudeMemHooks}: ${err.message}`);
    }
  }

  // 3. Validate superpowers overlay (no unexpanded Claude variables)
  if (fs.existsSync(superpowersHooks)) {
    const spRaw = fs.readFileSync(superpowersHooks, 'utf8');
    if (spRaw.includes('${CLAUDE_PLUGIN_ROOT}')) {
      issues.push(`Unexpanded variable \${CLAUDE_PLUGIN_ROOT} found in ${superpowersHooks}`);
    }
  }

  // 4. Validate personal hooks in hooks/*.json
  if (fs.existsSync(hooksDir)) {
    const entries = fs.readdirSync(hooksDir).filter(f => f.endsWith('.json'));
    for (const file of entries) {
      if (file === 'guardrail-check.json') continue;
      const fPath = path.join(hooksDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(fPath, 'utf8'));
        if (data.hooks && typeof data.hooks === 'object') {
          for (const [evtName, groups] of Object.entries(data.hooks)) {
            if (!Array.isArray(groups)) continue;
            for (const grp of groups) {
              if (!Array.isArray(grp.hooks)) continue;
              for (const h of grp.hooks) {
                if (h.timeout && Number(h.timeout) > 15) {
                  warnings.push(`Hook '${file}' (${evtName}) has excessive timeout of ${h.timeout}s (> 15s).`);
                }
                if (['PostToolUse', 'PreToolUse'].includes(evtName) && (!h.timeout || Number(h.timeout) > 5)) {
                  issues.push(`Tool hook '${file}' (${evtName}) must specify timeout <= 5s to avoid turn freezes.`);
                }
              }
            }
          }
        }
      } catch (err) {
        issues.push(`Invalid JSON in ${fPath}: ${err.message}`);
      }
    }
  }

  // 5. Live inspect check (if full mode and not testing mock dir)
  if (!fast && !skipLive) {
    const grokBin = path.join(root, 'bin', 'grok.exe');
    if (fs.existsSync(grokBin)) {
      const inspectRes = spawnSync(grokBin, ['inspect', '--json'], {
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (inspectRes.status === 0 && inspectRes.stdout) {
        try {
          const parsed = JSON.parse(inspectRes.stdout);
          const errors = parsed.hookLoadErrors || [];
          if (errors.length > 0) {
            issues.push(`grok inspect reported ${errors.length} hook load error(s): ${errors.join(', ')}`);
          }

          if (parsed.externalCompat?.cells) {
            const claudeCell = parsed.externalCompat.cells.find(c => c.vendor === 'claude' && c.surface === 'hooks');
            if (claudeCell && claudeCell.enabled === true) {
              issues.push("grok inspect confirmed claude hooks surface is active (expected: disabled)");
            }
            const cursorCell = parsed.externalCompat.cells.find(c => c.vendor === 'cursor' && c.surface === 'hooks');
            if (cursorCell && cursorCell.enabled === true) {
              issues.push("grok inspect confirmed cursor hooks surface is active (expected: disabled)");
            }
          }
        } catch (err) {
          warnings.push(`Could not parse grok inspect output: ${err.message}`);
        }
      } else {
        warnings.push(`grok inspect failed with code ${inspectRes.status}`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

// CLI runner if invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const args = process.argv.slice(2);
  const fast = args.includes('--fast');
  let grokHome = null;
  const homeIdx = args.indexOf('--grok-home');
  if (homeIdx !== -1 && args[homeIdx + 1]) {
    grokHome = args[homeIdx + 1];
  }

  const result = validateGrokHooks({ grokHome, fast });
  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`[grok-guardrail:WARN] ${w}`);
    }
  }

  if (!result.valid) {
    console.error(`[grok-guardrail:FAIL] Found ${result.issues.length} configuration problem(s):`);
    for (const err of result.issues) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(`[grok-guardrail:PASS] Grok hook configuration is healthy (fast=${fast})`);
  process.exit(0);
}

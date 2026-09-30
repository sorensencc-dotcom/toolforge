#!/usr/bin/env node
// Meridian runs headless Claude Code with cwd ~/.meridian, so global hooks and
// auto-memory fire on prompts built from captured screen text. This check
// fails if that isolation regresses. Run after a Meridian worklog cycle.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();

export const DEFAULT_DIRS = {
  meridianDir: path.join(HOME, '.meridian'),
  claudeProjectDir: path.join(HOME, '.claude', 'projects', 'C--Users-soren--meridian')
};

function readSettings(meridianDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(meridianDir, '.claude', 'settings.json'), 'utf8'));
  } catch {
    return null;
  }
}

function hasEntries(dir) {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export function checkMeridianIsolation({ meridianDir, claudeProjectDir } = DEFAULT_DIRS) {
  const violations = [];
  const settings = readSettings(meridianDir);

  if (!settings) {
    violations.push({ code: 'settings-missing', detail: `${meridianDir}/.claude/settings.json missing or unparseable` });
  } else {
    if (settings.disableAllHooks !== true) {
      violations.push({ code: 'hooks-enabled', detail: 'disableAllHooks is not true' });
    }
    if (settings.autoMemoryEnabled !== false) {
      violations.push({ code: 'auto-memory-enabled', detail: 'autoMemoryEnabled is not false' });
    }
  }

  if (fs.existsSync(path.join(meridianDir, 'graft'))) {
    violations.push({ code: 'graft-cache-present', detail: `${meridianDir}/graft exists; graft hook ran on a Meridian prompt` });
  }

  if (hasEntries(path.join(claudeProjectDir, 'memory'))) {
    violations.push({ code: 'auto-memory-written', detail: `${claudeProjectDir}/memory has files; may contain screen-derived text` });
  }

  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkMeridianIsolation();
  for (const v of violations) console.error(`[meridian-isolation] FAIL ${v.code}: ${v.detail}`);
  if (violations.length === 0) console.log('[meridian-isolation] PASS');
  process.exit(violations.length === 0 ? 0 : 1);
}

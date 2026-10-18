#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export const ALLOWED_ROADMAP_ROOTS = [
  'docs/meta/',
  'cic-ingestion/',
  'rewrite-docs/',
  'rewrite-mcp/',
  'kb-sync/',
];

export function isRoadmapFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const base = path.basename(filePath).toLowerCase();
  return base === 'roadmap.md';
}

export function isAllowedRoadmapLocation(filePath) {
  if (!isRoadmapFile(filePath)) {
    return true;
  }
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return ALLOWED_ROADMAP_ROOTS.some(root => normalized.startsWith(root));
}

export function validateRoadmapPaths(paths) {
  const violations = [];
  const scanned = [];
  for (const p of paths) {
    if (!p || typeof p !== 'string') continue;
    const clean = p.trim();
    if (!clean) continue;
    if (isRoadmapFile(clean)) {
      scanned.push(clean);
      if (!isAllowedRoadmapLocation(clean)) {
        violations.push(clean);
      }
    }
  }
  return {
    ok: violations.length === 0,
    scanned,
    violations,
  };
}

export function getStagedFiles(cwd = process.cwd()) {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function getTrackedFiles(cwd = process.cwd()) {
  try {
    const output = execSync('git ls-files', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function runCli(args = process.argv.slice(2), cwd = process.cwd()) {
  let mode = 'all';
  const customFiles = [];

  for (const arg of args) {
    if (arg === '--staged') {
      mode = 'staged';
    } else if (arg === '--all') {
      mode = 'all';
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/governance/check-roadmap-location.mjs [--staged | --all | <files...>]');
      return 0;
    } else if (!arg.startsWith('-')) {
      customFiles.push(arg);
    }
  }

  let filesToCheck = [];
  if (customFiles.length > 0) {
    filesToCheck = customFiles;
  } else if (mode === 'staged') {
    filesToCheck = getStagedFiles(cwd);
  } else {
    filesToCheck = getTrackedFiles(cwd);
  }

  const result = validateRoadmapPaths(filesToCheck);
  if (!result.ok) {
    console.error('\x1b[31m[GOVERNANCE ERROR] ROADMAP.md placement violation detected.\x1b[0m');
    console.error('');
    console.error('Roadmaps are permitted ONLY in docs/meta/ (global) or project roots:');
    for (const root of ALLOWED_ROADMAP_ROOTS) {
      console.error(`  - ${root}`);
    }
    console.error('');
    console.error('Violations:');
    for (const v of result.violations) {
      console.error(`  - \x1b[31m${v}\x1b[0m`);
    }
    console.error('');
    console.error('Governance: docs/meta/governance/documentation-policy.md');
    return 1;
  }

  console.log(`[GOVERNANCE] Roadmap location check passed (${result.scanned.length} roadmap(s) verified).`);
  return 0;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFile && (invokedFile === path.resolve(currentFile) || invokedFile === fs.realpathSync(currentFile))) {
  const exitCode = runCli();
  process.exit(exitCode);
}

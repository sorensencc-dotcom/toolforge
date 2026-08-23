#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pre-Flight Test Checker
 * Validates test environment before running npm test.
 * Returns RED (blockers) | YELLOW (warnings) | GREEN (ready).
 */

const REQUIRED_IGNORE_ENTRIES = ['dist/', 'build/', 'node_modules/'];
const KNOWN_FIXTURES = [{ name: 'cic-research-vault', optional: true }];
const UNIX_ONLY_PATTERNS = [
  { pattern: /['"]\/tmp\//, hint: 'hardcoded /tmp path — use os.tmpdir()' },
  { pattern: /['"]\/home\//, hint: 'hardcoded /home path — use os.homedir()' },
  { pattern: /process\.platform\s*!==\s*['"]win32['"]/, hint: 'inverted platform check — verify Windows is actually exercised' },
];

export function checkEslintConfig(repoRoot) {
  const eslintignorePath = path.join(repoRoot, '.eslintignore');

  if (!fs.existsSync(eslintignorePath)) {
    return {
      name: 'ESLint Config',
      level: 'error',
      message: '.eslintignore not found',
      details: [`Create .eslintignore with entries: ${REQUIRED_IGNORE_ENTRIES.join(', ')}`],
    };
  }

  const content = fs.readFileSync(eslintignorePath, 'utf8');
  const missing = REQUIRED_IGNORE_ENTRIES.filter((entry) => !content.includes(entry));

  if (missing.length > 0) {
    return {
      name: 'ESLint Config',
      level: 'error',
      message: `.eslintignore missing entries: ${missing.join(', ')}`,
      details: [`Add to .eslintignore: ${missing.join(', ')}`],
    };
  }

  return { name: 'ESLint Config', level: 'pass', message: '.eslintignore configured correctly' };
}

export function checkExternalFixtures(repoRoot, knownFixtures = KNOWN_FIXTURES) {
  const workspaceRoot = path.dirname(repoRoot);
  const missingRequired = [];
  const missingOptional = [];

  for (const fixture of knownFixtures) {
    const fixturePath = path.join(workspaceRoot, fixture.name);
    if (!fs.existsSync(fixturePath)) {
      (fixture.optional ? missingOptional : missingRequired).push(fixture.name);
    }
  }

  if (missingRequired.length > 0) {
    return {
      name: 'External Fixtures',
      level: 'error',
      message: `Missing required fixtures: ${missingRequired.join(', ')}`,
      details: [`Mount or clone: ${missingRequired.join(', ')}`],
    };
  }

  if (missingOptional.length > 0) {
    return {
      name: 'External Fixtures',
      level: 'warning',
      message: `Optional fixtures unavailable, will skip gracefully: ${missingOptional.join(', ')}`,
    };
  }

  return { name: 'External Fixtures', level: 'pass', message: 'All fixtures available' };
}

export function checkPlatformCompliance(repoRoot) {
  const testDir = path.join(repoRoot, 'tests');
  if (!fs.existsSync(testDir)) {
    return { name: 'Platform Compliance', level: 'pass', message: 'No test directory found (skipping platform checks)' };
  }

  const offenders = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8');
        for (const { pattern, hint } of UNIX_ONLY_PATTERNS) {
          if (pattern.test(content)) offenders.push(`${path.relative(repoRoot, full)}: ${hint}`);
        }
      }
    }
  };
  scan(testDir);

  if (offenders.length > 0) {
    return {
      name: 'Platform Compliance',
      level: 'warning',
      message: `${offenders.length} test file(s) contain platform-specific assumptions`,
      details: offenders,
    };
  }

  return { name: 'Platform Compliance', level: 'pass', message: 'No platform-specific assumptions found in test files' };
}

export function runPreflight(repoRoot, knownFixtures = KNOWN_FIXTURES) {
  const checks = [checkEslintConfig(repoRoot), checkExternalFixtures(repoRoot, knownFixtures), checkPlatformCompliance(repoRoot)];

  let level = 'pass';
  for (const c of checks) {
    if (c.level === 'error') level = 'error';
    else if (c.level === 'warning' && level !== 'error') level = 'warning';
  }

  let verdict = 'GREEN';
  if (level === 'error') verdict = 'RED';
  else if (level === 'warning') verdict = 'YELLOW';

  return {
    status: level === 'error' ? 'error' : 'success',
    verdict,
    checks,
    timestamp: new Date().toISOString(),
    readyToTest: verdict !== 'RED',
  };
}

function printReport(output, verbose) {
  if (verbose) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  output.checks.forEach((c) => {
    const icon = { pass: '✓', warning: '⚠', error: '❌' }[c.level];
    console.log(`${icon} ${c.name}: ${c.message}`);
    if (c.details) c.details.forEach((d) => console.log(`  -> ${d}`));
  });
  console.log(`\n${output.verdict} - ${output.readyToTest ? 'Ready to run npm test' : 'Blockers found, fix above issues'}`);
}

function main() {
  const args = {
    repoRoot: (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : process.cwd(),
    verbose: process.argv.includes('--verbose'),
    failOnWarning: process.argv.includes('--failOnWarning'),
  };

  const output = runPreflight(args.repoRoot);
  printReport(output, args.verbose);

  process.exit(
    output.verdict === 'GREEN' ? 0 :
    output.verdict === 'YELLOW' ? (args.failOnWarning ? 1 : 0) :
    2
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();

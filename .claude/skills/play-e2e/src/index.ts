#!/usr/bin/env node

/**
 * play-e2e skill: Playwright E2E test runner
 * Run, debug, and manage Playwright tests
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REWRITE_DOCS_DIR = 'rewrite-docs';
const TESTS_DIR = path.join(REWRITE_DOCS_DIR, 'tests/snapshots');

function listTests(): void {
  if (!fs.existsSync(TESTS_DIR)) {
    console.error(`❌ Tests directory not found: ${TESTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js'))
    .sort();

  if (files.length === 0) {
    console.log('No test files found.');
    return;
  }

  console.log(`📋 Available tests (${files.length}):\n`);
  files.forEach(file => {
    console.log(`  • ${file}`);
  });
}

function run(testPattern?: string): void {
  const cmd = testPattern
    ? `npm run test:e2e -- ${testPattern}`
    : 'npm run test:e2e';

  console.log(`▶️  Running: ${cmd}\n`);

  try {
    execSync(cmd, {
      cwd: REWRITE_DOCS_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('\n❌ Tests failed');
    process.exit(1);
  }
}

function debug(testPattern: string): void {
  if (!testPattern) {
    console.error('❌ Test pattern required for debug mode');
    console.error('Usage: play-e2e debug <pattern>');
    process.exit(1);
  }

  const cmd = `npm run test:e2e -- --debug ${testPattern}`;
  console.log(`🐛 Debug mode: ${cmd}\n`);

  try {
    execSync(cmd, {
      cwd: REWRITE_DOCS_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('\n⚠️  Debug exited');
    process.exit(1);
  }
}

function updateSnapshots(testPattern?: string): void {
  const cmd = testPattern
    ? `npm run test:e2e -- --update-snapshots ${testPattern}`
    : 'npm run test:e2e -- --update-snapshots';

  console.log(`📸 Updating snapshots: ${cmd}\n`);

  try {
    execSync(cmd, {
      cwd: REWRITE_DOCS_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('\n⚠️  Snapshot update incomplete');
    process.exit(1);
  }
}

function report(): void {
  const reportPath = path.join(REWRITE_DOCS_DIR, 'playwright-report');
  if (!fs.existsSync(reportPath)) {
    console.log('No test report found. Run tests first.');
    return;
  }

  console.log(`📊 Test report: ${reportPath}`);
  console.log(`Open in browser: npx playwright show-report`);
}

// CLI
const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case 'list':
    listTests();
    break;
  case 'run':
    run(arg);
    break;
  case 'debug':
    debug(arg || '');
    break;
  case 'update':
    updateSnapshots(arg);
    break;
  case 'report':
    report();
    break;
  default:
    console.log(`Usage: play-e2e <list|run|debug|update|report> [test-pattern]

Commands:
  list                    List available tests
  run [pattern]          Run tests (all or matching pattern)
  debug <pattern>        Run single test in debug mode
  update [pattern]       Update snapshots for tests
  report                 Show test report location

Examples:
  play-e2e run
  play-e2e run button
  play-e2e debug button.spec.ts
  play-e2e update
`);
}

#!/usr/bin/env node

/**
 * E2E snapshot hook: auto-run Playwright tests after component edits
 * Triggers on .stories.ts, .stories.tsx, .tsx (in rewrite-docs components)
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const filePath = args[0];

if (!filePath) {
  process.exit(0);
}

const isRewriteDocsFile = filePath.includes('rewrite-docs');
const isComponentFile = /\.(stories\.tsx?|tsx)$/.test(filePath);
const isTestFile = filePath.includes('tests/snapshots');

// Don't re-run tests if we're already in a test file
if (isTestFile) {
  process.exit(0);
}

// Only run tests for component edits in rewrite-docs
if (!isRewriteDocsFile || !isComponentFile) {
  process.exit(0);
}

const fileName = path.basename(filePath);
console.log(`\n📸 Running E2E snapshots for ${fileName}...\n`);

try {
  execSync('npm run test:e2e', {
    cwd: 'rewrite-docs',
    stdio: 'inherit',
    timeout: 120000, // 2 min timeout
  });
  console.log('\n✅ Snapshots verified\n');
  process.exit(0);
} catch (err) {
  // Test failures are expected; don't block edits
  console.warn('\n⚠️  Snapshots need update (run: play-e2e update)\n');
  process.exit(0);
}

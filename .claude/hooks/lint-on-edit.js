#!/usr/bin/env node

/**
 * Lint-on-edit hook: auto-fix ESLint issues after edits
 * Runs: npm run lint -- --fix [file]
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const filePath = args[0];

if (!filePath) {
  process.exit(0);
}

const ext = path.extname(filePath);
const lintableExts = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

if (!lintableExts.includes(ext)) {
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  process.exit(0);
}

try {
  const result = execSync(`npm run lint -- --fix "${filePath}"`, {
    stdio: 'inherit',
    timeout: 30000,
  });
  process.exit(0);
} catch (err) {
  // Lint failures are non-fatal; lint warnings shouldn't block edits
  process.exit(0);
}

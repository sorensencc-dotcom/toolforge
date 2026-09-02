#!/usr/bin/env node

/**
 * Block edits to lock files (package-lock.json, yarn.lock, pnpm-lock.yaml, Gemfile.lock, etc.)
 * Use `npm install` or equivalent instead to update lock files.
 */

import path from 'path';

const LOCK_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'pipfile.lock',
];

const args = process.argv.slice(2);
const filePath = args[0];

if (!filePath) {
  process.exit(0);
}

const fileName = path.basename(filePath);
const isLockFile = LOCK_FILES.some(
  (lockFile) => fileName === lockFile || fileName.endsWith(`-${lockFile}`)
);

if (isLockFile) {
  console.error(`❌ Cannot edit ${fileName} directly.`);
  console.error(`Use the package manager instead:`);
  console.error(`  • npm install`);
  console.error(`  • yarn install`);
  console.error(`  • pnpm install`);
  process.exit(1);
}

process.exit(0);

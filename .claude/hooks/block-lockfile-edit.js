#!/usr/bin/env node

/**
 * Block edits to lock files (package-lock.json, yarn.lock, pnpm-lock.yaml, Gemfile.lock, etc.)
 * Use `npm install` or equivalent instead to update lock files.
 *
 * Reads the PreToolUse JSON envelope on stdin. argv[2] remains as a fallback.
 * Grok fail-opens on exit 1, so a deny is JSON permissionDecision, then exit 0.
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

function filePathFrom(hookData) {
  const input = hookData.tool_input || hookData.toolInput || hookData.tool?.input || {};
  return (
    input.file_path ||
    input.filePath ||
    input.path ||
    process.argv[2] ||
    ''
  );
}

function deny(fileName) {
  const reason =
    `Blocked: cannot edit ${fileName} directly. Use npm install, yarn install, or pnpm install.`;
  console.error(`❌ Cannot edit ${fileName} directly.`);
  console.error(`Use the package manager instead:`);
  console.error(`  • npm install`);
  console.error(`  • yarn install`);
  console.error(`  • pnpm install`);
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function check(filePath) {
  if (!filePath) process.exit(0);
  const fileName = path.basename(filePath);
  const isLockFile = LOCK_FILES.some(
    (lockFile) => fileName === lockFile || fileName.endsWith(`-${lockFile}`)
  );
  if (isLockFile) deny(fileName);
  process.exit(0);
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let hookData = {};
  try {
    hookData = JSON.parse(data || '{}');
  } catch {
    hookData = {};
  }
  check(filePathFrom(hookData));
});

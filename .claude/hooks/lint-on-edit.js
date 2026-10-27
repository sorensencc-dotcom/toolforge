#!/usr/bin/env node

/**
 * Lint-on-edit hook: auto-fix ESLint issues after edits
 * Runs: npm run lint -- --fix [file]
 *
 * Reads the PostToolUse JSON envelope on stdin. argv[2] remains as a fallback.
 */

import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

// npm is npm.cmd on Windows; .cmd needs a shell, so quote args ourselves.
const isWin = process.platform === 'win32';
const npmBin = isWin ? 'npm.cmd' : 'npm';
const npmArg = (a) => (isWin ? '"' + a.replace(/"/g, '') + '"' : a);
const lintableExts = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

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

function lint(filePath) {
  if (!filePath) process.exit(0);
  const ext = path.extname(filePath);
  if (!lintableExts.includes(ext)) process.exit(0);
  if (!fs.existsSync(filePath)) process.exit(0);

  try {
    execFileSync(npmBin, ['run', 'lint', '--', '--fix', npmArg(filePath)], {
      shell: isWin,
      stdio: 'inherit',
      timeout: 30000,
    });
  } catch {
    // Lint failures are non-fatal; lint warnings shouldn't block edits
  }
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
  lint(filePathFrom(hookData));
});

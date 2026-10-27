#!/usr/bin/env node

/**
 * E2E snapshot hook: auto-run Playwright tests after component edits
 * Triggers on .stories.ts, .stories.tsx, .tsx (in rewrite-docs components)
 *
 * Reads the PostToolUse JSON envelope on stdin. argv[2] remains as a fallback.
 */

import path from 'path';
import { execFileSync } from 'child_process';

const isWin = process.platform === 'win32';

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

function run(filePath) {
  if (!filePath) process.exit(0);

  const isRewriteDocsFile = filePath.includes('rewrite-docs');
  const isComponentFile = /\.(stories\.tsx?|tsx)$/.test(filePath);
  const isTestFile = filePath.includes('tests/snapshots');

  if (isTestFile) process.exit(0);
  if (!isRewriteDocsFile || !isComponentFile) process.exit(0);

  const fileName = path.basename(filePath);
  console.log(`\n📸 Running E2E snapshots for ${fileName}...\n`);

  try {
    execFileSync(isWin ? 'npm.cmd' : 'npm', ['run', 'test:e2e'], {
      shell: isWin,
      cwd: 'rewrite-docs',
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('\n✅ Snapshots verified\n');
  } catch {
    console.warn('\n⚠️  Snapshots need update (run: play-e2e update)\n');
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
  run(filePathFrom(hookData));
});

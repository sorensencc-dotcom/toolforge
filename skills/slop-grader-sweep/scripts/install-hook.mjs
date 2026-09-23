import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKER = '# slop-grader-sweep: installed';
const HOOK_LINE = 'node skills/slop-grader-sweep/dist/cli.js changed';

export function installHook(hookPath) {
  let content = '';

  if (existsSync(hookPath)) {
    content = readFileSync(hookPath, 'utf8');
    if (content.includes(MARKER)) {
      return { installed: false, reason: 'already installed' };
    }
  } else {
    mkdirSync(dirname(hookPath), { recursive: true });
  }

  const block = `\n${MARKER}\n${HOOK_LINE}\n`;
  writeFileSync(hookPath, content + block, 'utf8');
  return { installed: true };
}

function isMain() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(__dirname, '..', '..', '..');
  const hookPath = join(repoRoot, '.git', 'hooks', 'pre-commit.ps1');
  const result = installHook(hookPath);
  console.log(result.installed ? `slop-grader-sweep hook installed at ${hookPath}` : 'slop-grader-sweep hook already installed, skipping');
}

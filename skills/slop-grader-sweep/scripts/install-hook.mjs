import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKER = '# slop-grader-sweep: installed';
const HOOK_LINE = 'node skills/slop-grader-sweep/dist/cli.js changed';

/**
 * Index of the first top-level terminal `exit` statement, or -1.
 *
 * A PowerShell hook that ends in `exit 0` / `exit $LASTEXITCODE` makes
 * everything appended after it dead code, so the block has to land above it.
 * Only unindented `exit` lines count as top-level — an indented one sits inside
 * a block and is not necessarily terminal.
 */
export function findTerminalExitIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (/^exit(\s|$)/.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

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

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const block = ['', MARKER, HOOK_LINE, ''];
  const exitIndex = findTerminalExitIndex(lines);

  const next =
    exitIndex === -1
      ? [...lines, ...block]
      : [...lines.slice(0, exitIndex), ...block, ...lines.slice(exitIndex)];

  writeFileSync(hookPath, next.join(eol), 'utf8');
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

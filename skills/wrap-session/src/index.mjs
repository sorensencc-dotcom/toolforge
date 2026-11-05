import { spawnSync } from 'node:child_process';

const MARKER_END = '<!-- TOOLFORGE-VAULT-POINTER-END -->';

export function retroDecision(exitCode) {
  if (exitCode === 0) return 'run';
  if (exitCode === 1) return 'skip';
  throw new Error(`check-retro-needed.ps1 exited ${exitCode}; expected 0 or 1`);
}

export function checkRetroNeeded(repoRoot, run = spawnSync) {
  const r = run('pwsh', ['-NoProfile', '-File', 'scripts/check-retro-needed.ps1'], { cwd: repoRoot });
  return retroDecision(r.status);
}

export function buildStatusSection({ date, goal, done, decisions, tests, blockers, next }) {
  const v = (x) => (x && String(x).trim()) || 'none';
  return [
    `## Session wrap (${date})`,
    '',
    '### Active goal', '', v(goal), '',
    '### Completed work', '', v(done), '',
    '### Decisions', '', v(decisions), '',
    '### Tests', '', v(tests), '',
    '### Blockers', '', v(blockers), '',
    '### Next action', '', v(next), '',
  ].join('\n');
}

// Replace a same-date wrap section, else insert after the vault pointer block (or at the top).
export function insertSection(statusMd, section, date) {
  const heading = `## Session wrap (${date})`;
  const lines = statusMd.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start !== -1) {
    let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    if (end === -1) end = lines.length;
    lines.splice(start, end - start, ...section.split('\n'));
    return lines.join('\n');
  }
  const marker = lines.findIndex((l) => l.includes(MARKER_END));
  const at = marker === -1 ? 0 : marker + 1;
  lines.splice(at, 0, '', ...section.split('\n'));
  return lines.join('\n');
}

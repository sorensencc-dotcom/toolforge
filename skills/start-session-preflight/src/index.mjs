import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const PREFLIGHT_SCRIPT = 'C:\\dev\\scripts\\verify-repo-context.ps1';
export const FIELDS = ['Active goal', 'Completed work', 'Decisions', 'Tests', 'Blockers', 'Next action'];
const ALIASES = { goal: 'Active goal', done: 'Completed work', next: 'Next action' };

function fieldFor(heading) {
  const key = heading.trim().toLowerCase();
  return FIELDS.find((f) => f.toLowerCase() === key) ?? ALIASES[key] ?? null;
}

// The latest section wins: each matching heading resets that field's buffer.
export function parseStatus(markdown) {
  const buffers = {};
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,4}\s+(.+?)\s*$/);
    if (heading) {
      current = fieldFor(heading[1]);
      if (current) buffers[current] = [];
      continue;
    }
    if (current) buffers[current].push(line);
  }
  return Object.fromEntries(
    FIELDS.map((f) => [f, (buffers[f] ?? []).join('\n').trim() || 'none']),
  );
}

export function runPreflight(root, exec = execFileSync) {
  try {
    const output = exec('pwsh', ['-NoProfile', '-File', PREFLIGHT_SCRIPT, '-Path', root], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { pass: true, output: String(output).trim() };
  } catch (err) {
    const detail = String(err.stderr || err.stdout || err.message).trim();
    return { pass: false, error: detail.split(/\r?\n/).find(Boolean) ?? 'preflight failed' };
  }
}

export function formatBrief({ root, branch, status }) {
  const lines = [`PREFLIGHT: PASS  ${root}  ${branch}`];
  for (const f of FIELDS) lines.push(`${f}: ${status[f].replace(/\s*\n\s*/g, ' ')}`);
  return lines.join('\n');
}

export function loadBrief(root, deps = {}) {
  const result = runPreflight(root, deps.exec);
  if (!result.pass) return { pass: false, text: `PREFLIGHT: FAIL  ${root}\n${result.error}` };
  const statusPath = path.join(root, 'STATUS.md');
  const md = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8') : '';
  const branch = (deps.branch ?? (() =>
    execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim()))();
  return { pass: true, text: formatBrief({ root, branch, status: parseStatus(md) }) };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const root = process.argv[2];
  if (!root) {
    console.error('usage: node src/index.mjs <absolute-repo-root>');
    process.exit(2);
  }
  const { pass, text } = loadBrief(root);
  console.log(text);
  process.exit(pass ? 0 : 1);
}

#!/usr/bin/env node
// Verifier for a TRM dispatch run. Pure checkRun() plus gatherEvidence() for real worktrees.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEST_FILE = /(^|\/|\\)(tests?|__tests__)[\/\\]|\.test\.|\.spec\./i;
const PROTECTED = /^(_status-feed\/|trm-drive\/inbox\/)|ledger\.jsonl$/;
const FORBIDDEN = [
  /\.skip\(/, /\.only\(/, /test\.todo/, /@pytest\.mark\.skip/, /assert True/, /\bTODO\b/, /\bFIXME\b/,
  /\bXXX\b/, /NotImplemented/, /throw new Error\(['"`]not implemented/
];

const num = (out, key) => {
  const m = String(out).match(new RegExp(`^[#ℹ?]\\s*${key}\\s+(\\d+)`, 'm'));
  return m ? Number(m[1]) : null;
};

/** Parse DONE.md blocks headed `## Criterion: ...` (exact structure required by the brief). */
export function doneBlocks(md) {
  const blocks = [];
  for (const part of String(md || '').split(/^(?=## )/m)) {
    if (!part.startsWith('## ')) continue;
    const head = part.split('\n')[0].slice(3).trim();
    const m = head.match(/^Criterion:\s*(.+)$/i);
    blocks.push({ head, criterion: m ? m[1].trim() : null, body: part });
  }
  return blocks;
}

export function resolveScopedTestCmd({ testCmd = 'npm test', nameStatus = '', porcelain = '' } = {}) {
  const explicit = testCmd && !/^(npm test|npm run test|pnpm test)$/i.test(testCmd.trim());
  if (explicit) return testCmd;
  const files = new Set();
  for (const line of String(nameStatus).split(/\r?\n/).filter(Boolean)) {
    const parts = line.split('\t');
    const st = parts[0] || '';
    const file = (parts[parts.length - 1] || '').replace(/\\/g, '/');
    if (!file || st.startsWith('D')) continue;
    if (TEST_FILE.test(file)) files.add(file);
  }
  for (const line of String(porcelain).split(/\r?\n/).filter(Boolean)) {
    const st = line.slice(0, 2);
    const file = line.slice(3).trim().replace(/\\/g, '/');
    if (!file || st.includes('D')) continue;
    if (TEST_FILE.test(file)) files.add(file);
  }
  if (files.size) return `node --test ${[...files].join(' ')}`;
  return 'node --test';
}

export function checkRun(ev) {
  const gaps = [];
  const info = [];
  if (ev.doneMd == null) {
    gaps.push('DONE.md missing');
  } else {
    if (/Status:\s*NOT MET/i.test(ev.doneMd)) gaps.push('DONE.md has a criterion marked Status: NOT MET');
    const blocks = doneBlocks(ev.doneMd);
    for (const c of ev.criteria || []) {
      const b = blocks.find((x) => x.criterion && x.criterion.toLowerCase() === c.toLowerCase())
        || blocks.find((x) => x.criterion && x.criterion.toLowerCase().includes(c.toLowerCase()))
        || blocks.find((x) => x.head.toLowerCase().includes(c.toLowerCase()) && /^Criterion:/i.test(x.head));
      if (!b) { gaps.push(`DONE.md has no block for criterion: ${c}`); continue; }
      if (!/^Command:\s*\S/m.test(b.body) || !/^Output:\s*\S/m.test(b.body)) gaps.push(`DONE.md block lacks Command/Output: ${c}`);
    }
  }
  const t = ev.test || { code: 1, output: '' };
  if (t.code !== 0) gaps.push(`tests failed (exit ${t.code}): ${String(t.output).slice(-400)}`);
  if ((num(t.output, 'skipped') || 0) > 0 || (num(t.output, 'todo') || 0) > 0) gaps.push('test run reports skipped/todo tests');
  const count = num(t.output, 'tests');
  if (ev.baseTests != null && count != null && count < ev.baseTests) gaps.push(`test count dropped: ${count} < base ${ev.baseTests}`);
  for (const line of String(ev.nameStatus || '').split('\n').filter(Boolean)) {
    const [st, ...rest] = line.split('\t');
    const file = (rest[rest.length - 1] || '').replace(/\\/g, '/');
    if (st.startsWith('D') && TEST_FILE.test(file)) gaps.push(`deleted test file: ${file}`);
    if (PROTECTED.test(file)) gaps.push(`change to protected path: ${file}`);
  }
  for (const l of ev.addedLines || []) {
    if (FORBIDDEN.some((re) => re.test(l))) gaps.push(`forbidden pattern added: ${l.trim().slice(0, 120)}`);
  }
  // Commits are created by the dispatcher after a pass — do not require them here.
  if (ev.fullSuite && ev.fullSuite.code !== 0) {
    info.push(`pre-existing suite failures (info only, exit ${ev.fullSuite.code}): ${String(ev.fullSuite.output || '').slice(-200)}`);
  }
  return { ok: gaps.length === 0, gaps, info };
}

const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 << 20 });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
};

function parseCmd(testCmd) {
  const parts = [];
  let cur = '', q = null;
  for (const ch of testCmd) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) { if (cur) { parts.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : ['node', '--test'];
}

export function gatherEvidence({ worktree, criteria, testCmd = 'npm test', base = 'origin/main', baseTests = null, run = sh, runFullSuite = false }) {
  const donePath = path.join(worktree, 'DONE.md');
  const doneMd = fs.existsSync(donePath) ? fs.readFileSync(donePath, 'utf8') : null;
  const porcelain = run('git', ['status', '--porcelain', '-uall'], worktree).out;
  const nameStatusTracked = run('git', ['diff', '--name-status', `${base}...HEAD`], worktree).out;
  const nameStatusWork = run('git', ['diff', '--name-status', 'HEAD'], worktree).out;
  const nameStatusUntracked = porcelain.split(/\r?\n/).filter((l) => l.startsWith('??')).map((l) => `A\t${l.slice(3).trim()}`).join('\n');
  const nameStatus = [nameStatusTracked, nameStatusWork, nameStatusUntracked].filter(Boolean).join('\n');
  const scoped = resolveScopedTestCmd({ testCmd, nameStatus, porcelain });
  const [tc, ...ta] = parseCmd(scoped);
  const tr = run(tc, ta, worktree);
  let fullSuite = null;
  if (runFullSuite || /^(npm test|npm run test|pnpm test)$/i.test(String(testCmd).trim())) {
    const [fc, ...fa] = parseCmd(testCmd || 'npm test');
    // Only as info when scoped != full; never gates the verdict.
    if (scoped !== (testCmd || 'npm test')) fullSuite = (() => { const r = run(fc, fa, worktree); return { code: r.code, output: r.out }; })();
  }
  const diffHead = run('git', ['diff', '-U0', 'HEAD'], worktree).out;
  const diffBase = run('git', ['diff', '-U0', `${base}...HEAD`], worktree).out;
  const addedLines = `${diffBase}\n${diffHead}`.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  // Include untracked file contents' first lines? skip — nameStatus covers new files; forbidden checked on diffs.
  const shas = run('git', ['rev-list', `${base}..HEAD`], worktree).out.split('\n').filter(Boolean);
  const commits = shas.map((sha) => ({
    sha, files: run('git', ['show', '--name-only', '--format=', sha], worktree).out.split('\n').filter(Boolean)
  }));
  return { doneMd, criteria, test: { code: tr.code, output: tr.out, cmd: scoped }, baseTests, nameStatus, porcelain, addedLines, commits, fullSuite };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [worktree, criteriaFile, testCmd] = process.argv.slice(2);
  if (!worktree || !criteriaFile) {
    console.error('usage: node trm-dispatch-checker.mjs <worktree> <criteria.json> [test-cmd]');
    process.exit(2);
  }
  const criteria = JSON.parse(fs.readFileSync(criteriaFile, 'utf8'));
  const res = checkRun(gatherEvidence({ worktree, criteria, testCmd }));
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

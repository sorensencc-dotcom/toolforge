#!/usr/bin/env node
// Verifier for a TRM dispatch run. Pure checkRun() plus gatherEvidence() for real worktrees.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.test\.|\.spec\./;
const PROTECTED = /^(_status-feed\/|trm-drive\/inbox\/)|ledger\.jsonl$/;
const FORBIDDEN = [
  /\.skip\(/, /\.only\(/, /test\.todo/, /@pytest\.mark\.skip/, /assert True/, /\bTODO\b/, /\bFIXME\b/,
  /\bXXX\b/, /NotImplemented/, /throw new Error\(['"`]not implemented/
];

const num = (out, key) => {
  const m = String(out).match(new RegExp(`^[#ℹ]\\s*${key}\\s+(\\d+)`, 'm'));
  return m ? Number(m[1]) : null;
};

function doneBlocks(md) {
  const blocks = [];
  for (const part of md.split(/^(?=## )/m)) {
    if (part.startsWith('## ')) blocks.push({ head: part.split('\n')[0].slice(3).trim(), body: part });
  }
  return blocks;
}

export function checkRun(ev) {
  const gaps = [];
  if (ev.doneMd == null) {
    gaps.push('DONE.md missing');
  } else {
    if (/Status:\s*NOT MET/i.test(ev.doneMd)) gaps.push('DONE.md has a criterion marked Status: NOT MET');
    const blocks = doneBlocks(ev.doneMd);
    for (const c of ev.criteria || []) {
      const b = blocks.find((x) => x.head.toLowerCase().includes(c.toLowerCase()));
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
    const file = rest[rest.length - 1].replace(/\\/g, '/');
    if (st.startsWith('D') && TEST_FILE.test(file)) gaps.push(`deleted test file: ${file}`);
    if (PROTECTED.test(file)) gaps.push(`change to protected path: ${file}`);
  }
  for (const l of ev.addedLines || []) {
    if (FORBIDDEN.some((re) => re.test(l))) gaps.push(`forbidden pattern added: ${l.trim().slice(0, 120)}`);
  }
  const commits = ev.commits || [];
  if (!commits.length) {
    gaps.push('no commits on branch');
  } else {
    const testOnly = commits.some((c) => c.files.length && c.files.every((f) => TEST_FILE.test(f)));
    const impl = commits.some((c) => c.files.some((f) => !TEST_FILE.test(f)));
    if (!testOnly || !impl) gaps.push('tests and implementation are not in separate commits');
  }
  return { ok: gaps.length === 0, gaps };
}

const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 << 20 });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
};

export function gatherEvidence({ worktree, criteria, testCmd = 'npm test', base = 'origin/main', baseTests = null, run = sh }) {
  const donePath = path.join(worktree, 'DONE.md');
  const doneMd = fs.existsSync(donePath) ? fs.readFileSync(donePath, 'utf8') : null;
  const [tc, ...ta] = testCmd.split(' ');
  const tr = run(tc, ta, worktree);
  const nameStatus = run('git', ['diff', '--name-status', `${base}...HEAD`], worktree).out;
  const diff = run('git', ['diff', '-U0', `${base}...HEAD`], worktree).out;
  const addedLines = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const shas = run('git', ['rev-list', `${base}..HEAD`], worktree).out.split('\n').filter(Boolean);
  const commits = shas.map((sha) => ({
    sha, files: run('git', ['show', '--name-only', '--format=', sha], worktree).out.split('\n').filter(Boolean)
  }));
  return { doneMd, criteria, test: { code: tr.code, output: tr.out }, baseTests, nameStatus, addedLines, commits };
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

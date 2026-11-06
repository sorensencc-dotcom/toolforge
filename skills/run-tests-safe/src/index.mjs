// Spawning the test process is this skill's purpose; commands come from the caller, never from untrusted input.
import { spawn as nodeSpawn, spawnSync } from 'node:child_process'; // noqa: SEC-AUDITOR
import fs from 'node:fs';
import path from 'node:path';

export const LOCK_NAMES = ['.staging.lock', '.kb-sync.lock'];
const FILE_RE = /[\w@./\\:-]+\.(?:test|spec)\.(?:[cm]?[jt]s|tsx?|jsx?)/;

// Kill a process and its children. taskkill /T on Windows, process group elsewhere.
export function killTree(pid, { platform = process.platform, run = spawnSync, kill = process.kill } = {}) {
  if (platform === 'win32') {
    run('taskkill', ['/pid', String(pid), '/T', '/F']);
    return;
  }
  try { kill(-pid, 'SIGKILL'); } catch { kill(pid, 'SIGKILL'); }
}

// Run a command with a hard cap and a no-output cap. Never resolves a hang as a pass.
export function runWithTimeout(cmd, args = [], opts = {}) {
  const { cwd, timeoutMs = 60000, idleMs = 60000, spawn = nodeSpawn, kill = killTree } = opts;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32', detached: process.platform !== 'win32' });
    let output = '';
    let timedOut = null;
    let idleTimer;
    const stop = (reason) => {
      if (timedOut) return;
      timedOut = reason;
      kill(child.pid);
    };
    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => stop('idle'), idleMs);
    };
    const hardTimer = setTimeout(() => stop('hard'), timeoutMs);
    const onData = (d) => { output += d.toString(); armIdle(); };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    armIdle();
    const finish = (code) => {
      clearTimeout(idleTimer);
      clearTimeout(hardTimer);
      resolve({ code: timedOut ? null : code, output, timedOut });
    };
    child.on('error', (e) => { output += `\nspawn error: ${e.message}`; finish(1); });
    child.on('close', finish);
  });
}

// Last started top-level test file with no result line, from node:test spec or TAP output.
export function findHangingFile(output) {
  const started = [];
  const done = new Set();
  for (const raw of String(output).split(/\r?\n/)) {
    const tap = raw.match(/^# Subtest: (.+)$/);
    const spec = raw.match(/^[▶>] (.+)$/u);
    const start = tap || spec;
    if (start) { started.push(start[1].trim()); continue; }
    const res = raw.match(/^(?:not )?ok \d+ - (.+?)(?: #.*)?$/) || raw.match(/^[✔✖✗] (.+?)(?: \(\d[\d.]*ms\))?$/u);
    if (res) done.add(res[1].trim());
  }
  const open = started.filter((n) => !done.has(n));
  const file = [...open].reverse().find((n) => FILE_RE.test(n));
  if (file) return file.match(FILE_RE)[0];
  const seen = String(output).match(new RegExp(FILE_RE.source, 'g'));
  return seen ? seen[seen.length - 1] : null;
}

// Delete only the two known lock files, non-recursively, in each given directory.
export function clearLocks(dirs, fsImpl = fs) {
  const removed = [];
  for (const dir of dirs) {
    for (const name of LOCK_NAMES) {
      const p = path.join(dir, name);
      let st;
      try { st = fsImpl.lstatSync(p); } catch { continue; }
      if (!st.isFile()) continue;
      fsImpl.rmSync(p);
      removed.push(p);
    }
  }
  return removed;
}

// pass needs exit 0 and visible output: silence is not evidence of a pass.
export function classifyRun({ code, output = '', timedOut = null }) {
  if (timedOut) return 'hung';
  if (code === 0 && String(output).trim().length > 0) return 'pass';
  return 'fail';
}

// Extra flags for the diagnostic rerun, by runner.
export function retryArgs(runner) {
  if (runner === 'jest') return ['--detectOpenHandles', '--testTimeout=10000'];
  if (runner === 'vitest') return ['--testTimeout=10000'];
  return ['--test-timeout=10000'];
}

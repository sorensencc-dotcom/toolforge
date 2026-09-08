import { spawn } from 'node:child_process';

export function assertLinux() {
  if (process.platform !== 'linux') throw new Error('runtime-owner requires Linux');
}

export function spawnProcessGroup(commandArgs, envAllowlist, cwd, onOutput = () => {}) {
  assertLinux();
  if (!Array.isArray(commandArgs) || commandArgs.length === 0 || commandArgs.some((v) => typeof v !== 'string' || !v)) throw new TypeError('commandArgs must be a non-empty argv array');
  const env = Object.fromEntries(Object.entries(envAllowlist ?? {}).filter(([key]) => /^[A-Z_][A-Z0-9_]*$/.test(key)));
  const child = spawn(commandArgs[0], commandArgs.slice(1), { cwd, env: { ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const limit = 8192;
  for (const [stream, source] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
    let used = 0;
    source.on('data', (chunk) => {
      const text = String(chunk);
      const remaining = Math.max(0, limit - used);
      if (remaining) onOutput({ stream, data: text.slice(0, remaining), truncated: text.length > remaining });
      used += text.length;
    });
  }
  return { child, pid: child.pid, pgid: child.pid };
}

export function signalGroup(pgid, signal) {
  assertLinux();
  try { process.kill(-pgid, signal); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

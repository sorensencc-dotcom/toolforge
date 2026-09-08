import { readFile, readdir } from 'node:fs/promises';

async function proc(pid, file) { try { return await readFile(`/proc/${pid}/${file}`, 'utf8'); } catch { return null; } }
export async function sampleGroup(pids) {
  let rss = 0; let cpu = 0;
  for (const pid of pids) {
    const status = await proc(pid, 'status');
    const stat = await proc(pid, 'stat');
    if (status) rss += Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
    if (stat) cpu += Number(stat.trim().split(/\s+/)[13] ?? 0) + Number(stat.trim().split(/\s+/)[14] ?? 0);
  }
  return { rssBytes: rss, cpuTicks: cpu };
}

export async function groupMembers(pgid) {
  const members = [];
  for (const entry of await readdir('/proc').catch(() => [])) {
    if (!/^\d+$/.test(entry)) continue;
    const stat = await proc(entry, 'stat'); if (!stat) continue;
    const fields = stat.trim().split(/\s+/);
    if (Number(fields[4]) === pgid) members.push(Number(entry));
  }
  return members;
}

export function cpuPercent(previous, current, elapsedMs, ticksPerSecond = 100) {
  if (!previous || elapsedMs <= 0) return 0;
  return Math.max(0, ((current.cpuTicks - previous.cpuTicks) / ticksPerSecond) / (elapsedMs / 1000) * 100);
}

export function violation(sample, envelope) {
  return sample.rssBytes > envelope.memory_limit_mb * 1024 * 1024 || sample.cpuPercent > envelope.cpu_limit_percent;
}

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { validateEnvelope, transition } from './types.mjs';
import { createEventLog } from './logs.mjs';
import { spawnProcessGroup, signalGroup, assertLinux } from './process-groups.mjs';
import { sampleGroup, groupMembers, cpuPercent, violation as exceeds } from './limits.mjs';

export function createSupervisor({ logPath = join(tmpdir(), 'toolforge-runtime-owner', 'events.jsonl'), stateDir = join(tmpdir(), 'toolforge-runtime-owner') } = {}) {
  const groups = new Map(); const listeners = new Set(); const monitored = new Set();
  const log = createEventLog(logPath, (event) => listeners.forEach((fn) => fn(event)));
  async function event(group, event_type, fields = {}) { return log.emit({ group_id: group.groupId, owner: group.owner, workflow_id: group.envelope.workflow_id, state: group.state, pgid: group.pgid, ...fields, event_type }); }
  async function createGroup(owner, envelope) {
    assertLinux(); const groupId = randomUUID(); const group = { groupId, owner, envelope: validateEnvelope(owner, envelope), state: 'created', pids: [], pgid: null, violations: 0, startedAt: null };
    groups.set(groupId, group); await mkdir(stateDir, { recursive: true }); await writeFile(join(stateDir, `${groupId}.json`), JSON.stringify(group)); await event(group, 'group_created'); return groupId;
  }
  async function spawnInGroup(groupId, commandArgs, envAllowlist, cwd) {
    const group = groups.get(groupId); if (!group) throw new Error('group not found'); if (group.state !== 'created' && group.state !== 'running') throw new Error('group not spawnable'); if (group.pids.length >= group.envelope.max_concurrency) throw new Error('concurrency limit exceeded');
    const result = spawnProcessGroup(commandArgs, envAllowlist, cwd); group.pids.push(result.pid); group.pgid ??= result.pgid; group.state = transition(group.state, 'running'); group.startedAt ??= Date.now(); await persist(group); result.child.once('exit', async () => { group.pids = group.pids.filter((pid) => pid !== result.pid); await event(group, 'process_exited', { pid: result.pid }); if (!group.pids.length && group.state === 'running') { group.state = 'closed'; await event(group, 'cleanup_completed'); await persist(group); } }); await event(group, 'process_spawned', { pid: result.pid }); monitorGroup(groupId).catch(async (error) => { await event(group, 'cleanup_failed', { reason: `monitor failed: ${error.message}` }); await terminateGroup(groupId).catch(() => {}); }); return { pid: result.pid, pgid: result.pgid };
  }
  async function terminateGroup(groupId, gracefulTimeoutSeconds = 2) {
    const group = groups.get(groupId); if (!group) throw new Error('group not found'); if (group.state !== 'closed' && group.state !== 'terminating') group.state = transition(group.state, 'terminating'); await persist(group); await event(group, 'termination_started'); if (group.pgid) signalGroup(group.pgid, 'SIGTERM'); await new Promise((resolve) => setTimeout(resolve, gracefulTimeoutSeconds * 1000)); if (group.pgid) { const killed = signalGroup(group.pgid, 'SIGKILL'); if (killed) await event(group, 'process_killed'); } group.state = 'closed'; await persist(group); await event(group, 'cleanup_completed'); return { state: group.state, pgid: group.pgid };
  }
  async function getGroupStatus(groupId) { const group = groups.get(groupId); if (!group) throw new Error('group not found'); const pids = group.pgid ? await groupMembers(group.pgid) : group.pids; const sample = await sampleGroup(pids); return { pids, pgid: group.pgid, cpuUsage: sample.cpuTicks, rssUsage: sample.rssBytes, state: group.state }; }
  async function monitorGroup(groupId) {
    const group = groups.get(groupId); if (!group) throw new Error('group not found'); if (monitored.has(groupId)) return; monitored.add(groupId); let previous; let violations = 0; const started = Date.now();
    while (group.state === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const members = group.pgid ? await groupMembers(group.pgid) : group.pids; group.pids = members; const sample = await sampleGroup(members); sample.cpuPercent = cpuPercent(previous, sample, 250); previous = sample;
      if (Date.now() - started >= group.envelope.timeout_seconds * 1000) { await event(group, 'timeout', { reason: 'timeout envelope exceeded' }); await terminateGroup(groupId); break; }
      if (exceeds(sample, group.envelope)) violations += 1; else violations = 0;
      if (violations >= 2) { group.state = transition(group.state, 'violating'); await event(group, 'resource_violation', { reason: 'resource envelope exceeded' }); await terminateGroup(groupId); break; }
    }
    monitored.delete(groupId);
  }
  function onEvent(callback) { listeners.add(callback); return () => listeners.delete(callback); }
  async function persist(group) { const target = join(stateDir, `${group.groupId}.json`); const temp = `${target}.${process.pid}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify({ groupId: group.groupId, owner: group.owner, workflow_id: group.envelope.workflow_id, pgid: group.pgid, pids: group.pids, state: group.state })); const { rename, unlink } = await import('node:fs/promises'); try { await rename(temp, target); } catch (error) { await unlink(temp).catch(() => {}); throw error; } }
  async function extendEnvelope(groupId, extension) { const group = groups.get(groupId); if (!group) throw new Error('group not found'); if (!['created', 'running'].includes(group.state)) throw new Error('envelope cannot be extended in current state'); const next = { ...group.envelope, ...extension }; if (next.owner !== group.owner || next.cpu_limit_percent > group.envelope.cpu_limit_percent || next.memory_limit_mb > group.envelope.memory_limit_mb || next.max_concurrency > group.envelope.max_concurrency || next.timeout_seconds > group.envelope.timeout_seconds) throw new Error('envelope extension may not raise ceilings'); group.envelope = validateEnvelope(group.owner, next); await persist(group); return group.envelope; }
  return { createGroup, spawnInGroup, getGroupStatus, monitorGroup, terminateGroup, extendEnvelope, onEvent };
}

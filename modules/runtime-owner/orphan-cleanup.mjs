import { readFile, unlink } from 'node:fs/promises';
import { signalGroup } from './process-groups.mjs';
import { groupMembers } from './limits.mjs';

export async function cleanupOrphan(statePath, owner) {
  const record = JSON.parse(await readFile(statePath, 'utf8'));
  if (record.owner !== owner || !record.pgid || record.state === 'closed') throw new Error('orphan ownership mismatch');
  const members = await groupMembers(record.pgid);
  if (!record.pids?.some((pid) => members.includes(pid))) throw new Error('orphan process identity mismatch');
  signalGroup(record.pgid, 'SIGKILL');
  await unlink(statePath).catch(() => {});
  return { groupId: record.groupId, pgid: record.pgid, cleaned: true };
}

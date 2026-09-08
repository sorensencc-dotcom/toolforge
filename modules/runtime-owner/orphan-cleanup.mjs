import { readFile, unlink } from 'node:fs/promises';
import { signalGroup } from './process-groups.mjs';

export async function cleanupOrphan(statePath, owner) {
  const record = JSON.parse(await readFile(statePath, 'utf8'));
  if (record.owner !== owner || !record.pgid || record.state === 'closed') throw new Error('orphan ownership mismatch');
  signalGroup(record.pgid, 'SIGKILL');
  await unlink(statePath).catch(() => {});
  return { groupId: record.groupId, pgid: record.pgid, cleaned: true };
}

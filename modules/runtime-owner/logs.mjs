import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createEventLog(path, callback = () => {}) {
  const seq = new Map();
  async function emit(event) {
    const next = (seq.get(event.group_id) ?? 0) + 1;
    seq.set(event.group_id, next);
    const record = { event_id: `${event.group_id}:${next}`, seq: next, timestamp: new Date().toISOString(), enforcement_mode: 'linux-polling', pid: null, ...event };
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (error) {
      callback({ ...record, event_type: 'cleanup_failed', reason: `event persistence failed: ${error.message}` });
      try { process.stderr.write(`${JSON.stringify(record)}\n`); } catch {}
      return { record, error };
    }
    callback(record);
    return { record };
  }
  return { emit };
}

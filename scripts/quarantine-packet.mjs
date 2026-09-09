import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * scripts/quarantine-packet.mjs
 *
 * Writes a failure bundle for a quarantined strike packet into an ignored
 * `.quarantine/<packet>/<timestamp>/` directory: a `manifest.json`, the
 * captured Iron Gate stdout/stderr, and the candidate diff.
 *
 * It deliberately never writes into `wiki/lessons/`. Promoting an incident
 * into the wiki is a separate, deliberate step, not an automatic side effect
 * of a gate crash.
 *
 * Log/diff payload arrives as a single JSON object on stdin:
 *   { "stdout": string, "stderr": string, "diff": string, "mergeSha": string|null }
 */

function arg(name, fallback = '') {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function readStdinPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const packetId = arg('packet-id', 'unknown-packet');
const reason = arg('reason', 'INTEGRATION_IRON_GATE_FAILURE');
const baseSha = arg('base-sha') || null;
const branchName = arg('branch') || null;
const payload = readStdinPayload();

const timestamp = new Date().toISOString();
const safePacketId = packetId.replace(/[^a-zA-Z0-9-_]/g, '_');
const safeStamp = timestamp.replace(/[:.]/g, '-');
const incidentDir = path.resolve(process.cwd(), '.quarantine', safePacketId, safeStamp);
fs.mkdirSync(incidentDir, { recursive: true });

const manifest = {
  packetId,
  reason,
  timestamp,
  branch: branchName,
  baseSha,
  mergeSha: payload.mergeSha ?? null,
};

fs.writeFileSync(path.join(incidentDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(incidentDir, 'gate-stdout.log'), payload.stdout ?? '', 'utf8');
fs.writeFileSync(path.join(incidentDir, 'gate-stderr.log'), payload.stderr ?? '', 'utf8');
fs.writeFileSync(path.join(incidentDir, 'changes.diff'), payload.diff ?? '', 'utf8');

console.log(`[Quarantine] Incident bundle written: ${incidentDir}`);

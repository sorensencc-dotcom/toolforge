import fs from 'node:fs';
import path from 'node:path';
import { VikingError, ERROR_CODES } from './viking-resolver.mjs';

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new VikingError(ERROR_CODES.SNAPSHOT_UNAVAILABLE, 'Snapshot metadata is unreadable'); } }
export function readPinnedSnapshot({ vaultRoot, pointerPath = path.join(vaultRoot, '.nlm_pack', 'current_generation.json') }) {
  const pointer = readJson(pointerPath);
  const generationId = pointer.active_generation;
  if (typeof generationId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(generationId)) throw new VikingError(ERROR_CODES.SNAPSHOT_UNAVAILABLE, 'Pointer generation ID is invalid');
  const generationRoot = path.resolve(path.dirname(pointerPath), 'generations', generationId);
  const rootReal = fs.existsSync(generationRoot) ? fs.realpathSync(generationRoot) : null;
  if (!rootReal) throw new VikingError(ERROR_CODES.SNAPSHOT_UNAVAILABLE, 'Referenced generation is unavailable', { snapshot_id: generationId });
  const manifest = readJson(path.join(rootReal, 'manifest.json'));
  if (manifest.generation_id !== generationId || manifest.sha256 !== pointer.sha256) throw new VikingError(ERROR_CODES.INTEGRITY_FAILED, 'Pointer and generation manifest disagree', { snapshot_id: generationId });
  const filesManifest = path.join(rootReal, 'FILES.manifest.txt');
  if (!fs.existsSync(filesManifest) && !Array.isArray(manifest.files)) throw new VikingError(ERROR_CODES.MANIFEST_INVALID, 'Generation has no authoritative file manifest', { snapshot_id: generationId });
  return Object.freeze({ snapshotId: generationId, snapshotRoot: rootReal, contentHash: manifest.sha256, manifest });
}
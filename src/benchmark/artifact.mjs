import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Generates SHA-256 hash of a static file.
 * @param {string} filePath Path to file.
 * @returns {Promise<string>}
 */
export async function hashFile(filePath) {
  const content = await fs.readFile(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Atomically writes baseline JSON artifact using a temporary file and rename.
 * @param {string} targetPath Absolute or relative file path.
 * @param {Object} artifact Baseline data.
 * @returns {Promise<void>}
 */
export async function writeBaselineArtifact(targetPath, artifact) {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(artifact, null, 2) + '\n', 'utf-8');
  await fs.rename(tempPath, targetPath);
}

/**
 * Reads baseline artifact or returns null if missing.
 * @param {string} targetPath Path to artifact.
 * @returns {Promise<Object|null>}
 */
export async function readBaselineArtifact(targetPath) {
  try {
    const raw = await fs.readFile(targetPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

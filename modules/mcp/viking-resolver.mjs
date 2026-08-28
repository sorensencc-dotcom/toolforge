import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ERROR_CODES = Object.freeze({
  INVALID_URI: 'INVALID_URI',
  NAMESPACE_REJECTED: 'NAMESPACE_REJECTED',
  PATH_TRAVERSAL_REJECTED: 'PATH_TRAVERSAL_REJECTED',
  SNAPSHOT_UNAVAILABLE: 'SNAPSHOT_UNAVAILABLE',
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  TIER_UNAVAILABLE: 'TIER_UNAVAILABLE',
  INTEGRITY_FAILED: 'INTEGRITY_FAILED',
  RESOURCE_TOO_LARGE: 'RESOURCE_TOO_LARGE',
});

export class VikingError extends Error {
  constructor(code, message, data = {}) {
    super(message);
    this.name = 'VikingError';
    this.code = code;
    this.data = data;
  }
}

function normalizeRelative(raw) {
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { throw new VikingError(ERROR_CODES.INVALID_URI, 'URI contains invalid encoding'); }
  if (decoded === '') return '';
  if (decoded.includes('\\') || path.posix.isAbsolute(decoded) || decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new VikingError(ERROR_CODES.PATH_TRAVERSAL_REJECTED, 'Path is not a safe relative path');
  }
  const normalized = path.posix.normalize(decoded);
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || normalized.includes('\0')) {
    throw new VikingError(ERROR_CODES.PATH_TRAVERSAL_REJECTED, 'Path escapes the virtual root');
  }
  return normalized;
}

export function parseUri(input, configuredVault, { allowLegacy = false } = {}) {
  if (typeof input !== 'string' || !input.startsWith('viking://')) {
    throw new VikingError(ERROR_CODES.INVALID_URI, 'URI must use viking://');
  }
  const parts = input.slice('viking://'.length).split('/');
  let vault = parts.shift();
  let layer = parts.shift();
  if (allowLegacy && ['sources', 'wiki', 'schema'].includes(vault)) {
    parts.unshift(layer);
    layer = vault;
    vault = configuredVault;
  }
  if (!vault || vault !== configuredVault) {
    throw new VikingError(ERROR_CODES.NAMESPACE_REJECTED, 'Vault namespace is not active');
  }
  if (!['sources', 'wiki', 'schema'].includes(layer)) {
    throw new VikingError(ERROR_CODES.INVALID_URI, 'Unknown virtual layer');
  }
  const relativePath = normalizeRelative(parts.join('/'));
  return { vault, layer, relativePath, uri: `viking://${vault}/${layer}/${relativePath}` };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function createResolver({ vaultRoot, vaultName, snapshotId, layerRoots, tierIndex = {}, maxBytes = 1024 * 1024, allowLegacy = false }) {
  if (!vaultRoot || !vaultName || !snapshotId) throw new Error('vaultRoot, vaultName, and snapshotId are required');
  const roots = { sources: 'sources', wiki: 'wiki', schema: 'schema', ...layerRoots };
  const snapshotRoot = path.resolve(vaultRoot, '_kb-sync-staging', snapshotId);
  const rootReal = fs.existsSync(snapshotRoot) ? fs.realpathSync(snapshotRoot) : null;
  const manifestFile = rootReal ? path.join(rootReal, 'FILES.manifest.txt') : null;
  const manifestEntries = new Set();
  if (manifestFile && fs.existsSync(manifestFile)) {
    for (const line of fs.readFileSync(manifestFile, 'utf8').split(/\\r?\\n/)) {
      const entry = line.trim();
      if (entry && !entry.startsWith('#')) manifestEntries.add(entry.replaceAll('\\\\', '/'));
    }
  }

  function resolve(input) {
    const parsed = parseUri(input, vaultName, { allowLegacy });
    if (!rootReal) throw new VikingError(ERROR_CODES.SNAPSHOT_UNAVAILABLE, 'Selected snapshot is unavailable', { snapshot_id: snapshotId });
    if (!fs.existsSync(manifestFile) || manifestEntries.size === 0) throw new VikingError(ERROR_CODES.MANIFEST_INVALID, 'Snapshot manifest is missing or empty', { snapshot_id: snapshotId });
    const candidate = path.resolve(rootReal, roots[parsed.layer], parsed.relativePath);
    if (!candidate.startsWith(`${rootReal}${path.sep}`)) throw new VikingError(ERROR_CODES.PATH_TRAVERSAL_REJECTED, 'Resolved path escapes snapshot');
    if (!fs.existsSync(candidate)) throw new VikingError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Resource not found');
    return { parsed, candidate };
  }

  function readFile(input, tier = 'L1') {
    const { parsed, candidate } = resolve(input);
    if (!['L0', 'L1', 'L2'].includes(tier)) throw new VikingError(ERROR_CODES.INVALID_URI, 'Unknown resolution tier');
    const key = `${parsed.uri}:${tier}`;
    const record = tierIndex[key];
    if (tier !== 'L2' && !record) throw new VikingError(ERROR_CODES.TIER_UNAVAILABLE, 'Generated tier is unavailable', { uri: parsed.uri, tier });
    const file = tier === 'L2' ? candidate : path.resolve(rootReal, record.artifact);
    if (!file.startsWith(`${rootReal}${path.sep}`) || !fs.existsSync(file)) throw new VikingError(ERROR_CODES.TIER_UNAVAILABLE, 'Generated tier is unavailable', { uri: parsed.uri, tier });
    const stat = fs.statSync(file);
    if (stat.size > maxBytes) throw new VikingError(ERROR_CODES.RESOURCE_TOO_LARGE, 'Resource exceeds read limit', { max_bytes: maxBytes });
    const actualHash = sha256(file);
    if (record?.tier_hash && record.tier_hash !== actualHash) throw new VikingError(ERROR_CODES.INTEGRITY_FAILED, 'Tier hash mismatch', { uri: parsed.uri, tier });
    return { uri: parsed.uri, resolution_tier: tier, snapshot_id: snapshotId, stale: Boolean(record?.stale), sha256: actualHash, content: fs.readFileSync(file, 'utf8') };
  }

  function stat(input) {
    const { parsed, candidate } = resolve(input);
    const info = fs.statSync(candidate);
    return { uri: parsed.uri, snapshot_id: snapshotId, size_bytes: info.size, last_modified: info.mtime.toISOString(), sha256: sha256(candidate), verification_status: 'verified' };
  }

  function list(input) {
    const { parsed, candidate } = resolve(input);
    if (!fs.statSync(candidate).isDirectory()) throw new VikingError(ERROR_CODES.RESOURCE_NOT_FOUND, 'Directory not found');
    const entries = fs.readdirSync(candidate, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    return { uri: parsed.uri, snapshot_id: snapshotId, complete: true, directories: entries.filter((e) => e.isDirectory()).map((e) => e.name), files: entries.filter((e) => e.isFile()).map((e) => ({ name: e.name, uri: `${parsed.uri}/${e.name}`, abstract: tierIndex[`${parsed.uri}/${e.name}:L0`]?.abstract ?? null, tier_status: tierIndex[`${parsed.uri}/${e.name}:L0`] ? 'available' : 'TIER_UNAVAILABLE' })) };
  }

  return Object.freeze({ parseUri: (uri) => parseUri(uri, vaultName, { allowLegacy }), list, stat, read: readFile });
}

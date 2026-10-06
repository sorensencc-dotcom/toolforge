import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = fs.realpathSync(path.resolve(__dirname, '..'));

const IS_WIN = process.platform === 'win32';

/**
 * Normalizes casing on case-insensitive filesystems (Windows/macOS)
 * @param {string} p
 * @returns {string}
 */
function normalizeCase(p) {
  return IS_WIN ? p.toLowerCase() : p;
}

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS)
 * Strictly sorts object keys and formats numbers deterministically.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizeJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new TypeError('[JCS_ERROR] Cannot canonicalize non-finite numbers (NaN, Infinity)');
      }
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJson(item) ?? 'null');
    return `[${items.join(',')}]`;
  }

  const obj = /** @type {Record<string, unknown>} */ (value);
  const sortedKeys = Object.keys(obj).sort();
  const pairs = [];

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined && typeof val !== 'symbol' && typeof val !== 'function') {
      pairs.push(`${JSON.stringify(key)}:${canonicalizeJson(val)}`);
    }
  }

  return `{${pairs.join(',')}}`;
}

/**
 * Deterministic Floor verification gate.
 * Enforces path boundaries, character/byte span hash matching, JCS action hashing,
 * and deterministic telemetry trace assertions.
 */
export class DeterministicVerificationFloor {
  /**
   * @param {string} [rootDir]
   */
  constructor(rootDir = DEFAULT_ROOT) {
    this.rootDir = fs.realpathSync(path.resolve(rootDir));
  }

  /**
   * Layer 1: Canonical Path Boundary Hardening
   * Resolves paths safely with symlink traversal prevention, non-existent target support,
   * and Windows case-insensitive containment verification.
   *
   * @param {string} targetPath
   * @param {{ allowNonExistent?: boolean }} [options]
   * @returns {string} Canonical absolute path within project root
   */
  resolveSafePath(targetPath, { allowNonExistent = false } = {}) {
    if (typeof targetPath !== 'string' || targetPath.trim() === '') {
      throw new Error('[PATH_INVALID] Target path must be a non-empty string');
    }

    if (targetPath.includes('\0')) {
      throw new Error('[SECURITY_VIOLATION] Null byte detected in path');
    }

    const resolved = path.resolve(this.rootDir, targetPath);

    let canonicalTarget;
    let pathExists = false;
    try {
      fs.lstatSync(resolved);
      pathExists = true;
    } catch {
      pathExists = false;
    }

    if (pathExists) {
      canonicalTarget = fs.realpathSync(resolved);
    } else if (allowNonExistent) {
      // Find the nearest existing ancestor to realpath, then append remaining segments
      let current = resolved;
      const missingSegments = [];

      while (true) {
        let currentExists = false;
        try {
          fs.lstatSync(current);
          currentExists = true;
        } catch {
          currentExists = false;
        }

        if (currentExists) break;

        const parent = path.dirname(current);
        if (parent === current) {
          throw new Error(`[PATH_ERROR] Root filesystem reached while resolving non-existent path: ${resolved}`);
        }
        missingSegments.unshift(path.basename(current));
        current = parent;
      }

      const canonicalParent = fs.realpathSync(current);
      canonicalTarget = path.join(canonicalParent, ...missingSegments);
    } else {
      throw new Error(`[FILE_NOT_FOUND] Path does not exist: ${resolved}`);
    }

    // Path containment verification using relative check
    const rel = path.relative(this.rootDir, canonicalTarget);
    const normalizedRel = normalizeCase(rel);
    const normalizedTarget = normalizeCase(canonicalTarget);
    const normalizedRoot = normalizeCase(this.rootDir);

    if (
      normalizedRel.startsWith('..') ||
      path.isAbsolute(rel) ||
      (normalizedRel === '' && normalizedTarget !== normalizedRoot)
    ) {
      throw new Error(`[BOUNDARY_VIOLATION] Path escapes project root: ${canonicalTarget} (Root: ${this.rootDir})`);
    }

    return canonicalTarget;
  }

  /**
   * Opens a file safely within boundaries and returns a File Descriptor (prevents TOCTOU).
   * @param {string} targetPath
   * @param {string | number} [flags]
   * @returns {{ fd: number, safePath: string, close: () => void }}
   */
  openSafeFile(targetPath, flags = 'r') {
    const safePath = this.resolveSafePath(targetPath);
    const fd = fs.openSync(safePath, flags);
    return {
      fd,
      safePath,
      close: () => fs.closeSync(fd),
    };
  }

  /**
   * Layer 2: Span SHA-256 Hash Verification
   * Validates exact content slices using bounds-checked byte spans (default) or UTF-16 code units.
   *
   * @param {string | number} fileOrFd Path string or open file descriptor
   * @param {number} startOffset Start index
   * @param {number} endOffset End index
   * @param {string} expectedSha256 Expected hex hash
   * @param {{ unit?: 'utf8-bytes' | 'utf16-code-units' }} [options]
   * @returns {boolean}
   */
  verifySpanHash(fileOrFd, startOffset, endOffset, expectedSha256, { unit = 'utf8-bytes' } = {}) {
    if (!Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset)) {
      throw new Error(`[BOUNDS_ERROR] Offsets must be safe integers: start=${startOffset}, end=${endOffset}`);
    }
    if (startOffset < 0 || endOffset <= startOffset) {
      throw new Error(`[BOUNDS_ERROR] Invalid slice range: [${startOffset}:${endOffset}]`);
    }

    let buffer;
    if (typeof fileOrFd === 'number') {
      buffer = fs.readFileSync(fileOrFd);
    } else {
      const safePath = this.resolveSafePath(fileOrFd);
      buffer = fs.readFileSync(safePath);
    }

    let actualHash;
    if (unit === 'utf8-bytes') {
      if (endOffset > buffer.length) {
        throw new Error(
          `[BOUNDS_ERROR] End offset ${endOffset} exceeds buffer size ${buffer.length}`
        );
      }
      const slice = buffer.subarray(startOffset, endOffset);
      actualHash = crypto.createHash('sha256').update(slice).digest('hex');
    } else if (unit === 'utf16-code-units') {
      const text = buffer.toString('utf8');
      if (endOffset > text.length) {
        throw new Error(
          `[BOUNDS_ERROR] End offset ${endOffset} exceeds character length ${text.length}`
        );
      }
      const slice = text.slice(startOffset, endOffset);
      actualHash = crypto.createHash('sha256').update(slice, 'utf8').digest('hex');
    } else {
      throw new Error(`[UNIT_ERROR] Unsupported offset unit: ${unit}`);
    }

    if (typeof expectedSha256 !== 'string' || expectedSha256.trim() === '') {
      throw new Error('[HASH_INVALID] expectedSha256 must be a non-empty hex string');
    }

    const expectedNormalized = expectedSha256.trim().toLowerCase();
    if (actualHash !== expectedNormalized) {
      throw new Error(
        `[SPAN_HASH_MISMATCH] Target [${startOffset}:${endOffset}] expected ${expectedNormalized}, got ${actualHash}`
      );
    }

    return true;
  }

  /**
   * Layer 2: RFC 8785 Action Hash Computation
   * Calculates deterministic SHA-256 hash over canonical JSON bytes.
   *
   * @param {unknown} actionObject
   * @returns {string} SHA-256 hex digest
   */
  computeActionHash(actionObject) {
    const canonical = canonicalizeJson(actionObject);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Layer 4: Deterministic Telemetry & Side-Effect Assertion
   * Verifies execution telemetry and enforces write-ahead logging on mutating tools.
   *
   * @param {Array<{ id: string, tag: 'READ_ONLY' | 'MUTATING', exitCode: number, walRecordId?: string }>} spans
   * @returns {boolean}
   */
  assertTraceTelemetry(spans) {
    if (!Array.isArray(spans) || spans.length === 0) {
      throw new Error('[TELEMETRY_ERROR] Trace spans must be a non-empty array');
    }

    for (const span of spans) {
      if (!span || typeof span.id !== 'string' || span.id.trim() === '') {
        throw new Error('[TELEMETRY_ERROR] Span missing valid identifier');
      }

      if (span.tag !== 'READ_ONLY' && span.tag !== 'MUTATING') {
        throw new Error(`[UNTAGGED_SPAN] Span ${span.id} must be tagged 'READ_ONLY' or 'MUTATING'`);
      }

      if (!Number.isInteger(span.exitCode)) {
        throw new Error(`[INVALID_EXIT_CODE] Span ${span.id} lacks integer exitCode`);
      }

      if (span.exitCode !== 0) {
        throw new Error(`[EXECUTION_FAILURE] Span ${span.id} exited with non-zero code ${span.exitCode}`);
      }

      if (span.tag === 'MUTATING' && (!span.walRecordId || typeof span.walRecordId !== 'string')) {
        throw new Error(`[WAL_VIOLATION] Mutating span ${span.id} executed without valid Write-Ahead Log record`);
      }
    }

    return true;
  }
}

/**
 * Fail-closed gate for agent binary uploads.
 *
 * Blocks POST, PUT, and PATCH of images or debug dumps to public file hosts
 * and anonymous object storage. Loopback stays open so local tools keep working.
 * Session scratch lives under `.agent-scratch/<sessionId>/` with a byte cap and a TTL.
 */

import fs from 'node:fs';
import path from 'node:path';

export const SCRATCH_DIR_NAME = '.agent-scratch';
export const SCRATCH_MAX_BYTES = 32 * 1024 * 1024;
export const SCRATCH_TTL_MS = 24 * 60 * 60 * 1000;

/** Public hosts agents use as unauthenticated scratch CDNs. */
export const PUBLIC_BINARY_HOST_SUFFIXES = Object.freeze([
  'imgur.com',
  'postimages.org',
  'postimg.cc',
  'cloudinary.com',
  'catbox.moe',
  'imgbb.com',
  'ibb.co',
  'imagekit.io',
  'gyazo.com',
  'prnt.sc',
  'prntscr.com',
  'transfer.sh',
  'file.io',
  '0x0.st',
  'tmpfiles.org',
]);

const UPLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

const IMAGE_BASE64_MARKERS = [
  /data:image\/[a-z0-9.+-]+;base64,/i,
  /iVBORw0KGgo[A-Za-z0-9+/=]{40,}/,
  /\/9j\/[A-Za-z0-9+/=]{80,}/,
  /R0lGOD[A-Za-z0-9+/=]{40,}/,
];

const CREDENTIAL_MARKERS = [
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-ant-[A-Za-z0-9_-]{10,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const IMAGE_AT_RE = /@[^\s'"]+?\.(?:png|jpe?g|gif|webp|bmp|heic|heif)\b/i;
const IMAGE_UPLOAD_ARG_RE = /(?:--upload-file|--data-binary|--post-file|(?:^|\s)-T)\s+['"]?[^\s'"]+?\.(?:png|jpe?g|gif|webp|bmp|heic|heif)\b/i;

function allow(code, reason) {
  return { decision: 'allow', code, reason };
}

function deny(code, reason) {
  return { decision: 'deny', code, reason };
}

function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [key, value] of Object.entries(headers)) {
    out[String(key).toLowerCase()] = value;
  }
  return out;
}

function isLoopback(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

function hostMatches(hostname, suffixes) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isObjectStoreHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (host === 'storage.googleapis.com' || host.endsWith('.storage.googleapis.com')) return true;
  if (host === 'storage.cloud.google.com') return true;
  if (host === 's3.amazonaws.com' || host.endsWith('.s3.amazonaws.com')) return true;
  return /\.s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host);
}

function hasObjectStoreAuth(url, headers) {
  if (headers.authorization) return true;
  const query = url.searchParams;
  return query.has('X-Amz-Algorithm') || query.has('X-Goog-Algorithm') || query.has('X-Goog-Signature');
}

function payloadText(body) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

function containsImagePayload(text) {
  return IMAGE_BASE64_MARKERS.some((re) => re.test(text));
}

function containsCredential(text) {
  return CREDENTIAL_MARKERS.some((re) => re.test(text));
}

/**
 * @param {{ method?: string, url: string, headers?: object, body?: unknown, binaryFileUpload?: boolean }} request
 * @returns {{ decision: 'allow'|'deny', code: string, reason: string }}
 */
export function evaluateOutboundRequest(request = {}) {
  const method = String(request.method || 'GET').toUpperCase();
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return deny('malformed-url', 'Outbound URL must be absolute http or https.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return deny('unsupported-protocol', 'Only http and https targets are checked. Other protocols are denied.');
  }
  if (isLoopback(url.hostname)) {
    return allow('loopback', 'Loopback destinations stay on this machine.');
  }

  const upload = UPLOAD_METHODS.has(method);
  if (!upload) {
    return allow('read', 'Read requests are outside the upload gate.');
  }

  if (hostMatches(url.hostname, PUBLIC_BINARY_HOST_SUFFIXES)) {
    return deny(
      'public-binary-host',
      `Blocked ${method} to public binary host ${url.hostname}. Write the artifact under .agent-scratch/ instead.`,
    );
  }

  const headers = normalizeHeaders(request.headers);
  if (isObjectStoreHost(url.hostname) && !hasObjectStoreAuth(url, headers)) {
    return deny(
      'unauthenticated-object-store',
      `Blocked unauthenticated ${method} to object storage host ${url.hostname}.`,
    );
  }

  const text = payloadText(request.body);
  if (request.binaryFileUpload || containsImagePayload(text)) {
    return deny(
      'binary-payload',
      'Blocked outbound upload carrying an image or binary file. Keep it in the session scratchpad.',
    );
  }
  if (containsCredential(text)) {
    return deny('credential-material', 'Blocked outbound upload carrying credential-shaped material.');
  }

  return allow('ok', 'Request is not an unauthenticated binary upload.');
}

function explicitMethod(command) {
  const match = command.match(/(?:-X|--request|-Method)\s+['"]?(GET|POST|PUT|PATCH|DELETE|HEAD)['"]?/i);
  return match ? match[1].toUpperCase() : null;
}

function inferredMethod(command) {
  const explicit = explicitMethod(command);
  if (explicit) return explicit;
  if (/(?:^|\s)(?:-T|--upload-file)\b/i.test(command)) return 'PUT';
  if (/(?:^|\s)(?:-F|--form|--data-binary|--post-file)\b/i.test(command)) return 'POST';
  if (/(?:^|\s)(?:-d|--data|--data-raw)\b/i.test(command)) return 'POST';
  if (/-InFile\b/i.test(command)) return 'POST';
  return 'GET';
}

function isBinaryFileUpload(command) {
  return IMAGE_AT_RE.test(command) || IMAGE_UPLOAD_ARG_RE.test(command);
}

/**
 * Inspect a shell command for curl, wget, or Invoke-WebRequest uploads.
 * @param {string} command
 */
export function evaluateShellCommand(command) {
  if (!command || typeof command !== 'string') {
    return allow('empty', 'No command to inspect.');
  }
  const method = inferredMethod(command);
  const urls = [...command.matchAll(/https?:\/\/[^\s'")]+/gi)].map((match) => match[0]);
  const binaryFileUpload = isBinaryFileUpload(command);
  const inlineBody = /data:image|iVBORw0KGgo|\/9j\/|R0lGOD/.test(command) ? command : '';

  if (urls.length === 0) {
    if (binaryFileUpload && UPLOAD_METHODS.has(method)) {
      return deny(
        'binary-upload-without-destination',
        'Blocked an image upload command that has no visible destination. Use .agent-scratch/.',
      );
    }
    return allow('no-url', 'Command has no outbound URL.');
  }

  for (const url of urls) {
    const result = evaluateOutboundRequest({
      method,
      url,
      body: inlineBody,
      binaryFileUpload,
    });
    if (result.decision === 'deny') return result;
  }
  return allow('ok', 'Command is not an unauthenticated binary upload.');
}

function scratchBase(root) {
  return path.resolve(root, SCRATCH_DIR_NAME);
}

function assertInside(parent, child) {
  const prefix = parent.endsWith(path.sep) ? parent : parent + path.sep;
  if (child !== parent && !child.startsWith(prefix)) {
    const error = new Error('scratchpad path escaped the session directory');
    error.code = 'scratch-traversal';
    throw error;
  }
}

/**
 * Create `.agent-scratch/<sessionId>/` and record its expiry.
 */
export function provisionAgentScratchpad({
  root,
  sessionId,
  now = Date.now(),
  ttlMs = SCRATCH_TTL_MS,
  maxBytes = SCRATCH_MAX_BYTES,
} = {}) {
  if (typeof root !== 'string' || !root) throw new TypeError('root is required');
  if (!SESSION_ID_RE.test(sessionId || '')) throw new TypeError('sessionId must be a short safe token');
  const base = scratchBase(root);
  const dir = path.resolve(base, sessionId);
  assertInside(base, dir);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    sessionId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    maxBytes,
  };
  fs.writeFileSync(path.join(dir, '.scratch-meta.json'), JSON.stringify(meta));
  return { dir, ...meta };
}

/**
 * Reject writes that leave the session directory or exceed the byte cap.
 * Returns the absolute file path the caller may write.
 */
export function assertScratchpadWrite({ root, sessionId, relativePath, byteLength } = {}) {
  if (!Number.isFinite(byteLength) || byteLength < 0) throw new TypeError('byteLength must be a non-negative number');
  if (byteLength > SCRATCH_MAX_BYTES) {
    const error = new Error(`scratchpad write of ${byteLength} bytes exceeds the ${SCRATCH_MAX_BYTES} byte limit`);
    error.code = 'scratch-limit';
    throw error;
  }
  if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\0')) {
    const error = new Error('scratchpad path escaped the session directory');
    error.code = 'scratch-traversal';
    throw error;
  }
  const dir = path.resolve(scratchBase(root), sessionId);
  const target = path.resolve(dir, relativePath);
  assertInside(dir, target);
  if (target === dir) {
    const error = new Error('scratchpad path escaped the session directory');
    error.code = 'scratch-traversal';
    throw error;
  }
  return target;
}

/**
 * Delete session directories whose meta is missing, unreadable, or expired.
 * @returns {{ shredded: string[], errors: string[], dryRun: boolean }}
 */
export function shredExpiredScratchpads(root, now = Date.now(), { dryRun = false } = {}) {
  const base = scratchBase(root);
  if (!fs.existsSync(base)) return { shredded: [], errors: [], dryRun };
  const shredded = [];
  const errors = [];
  for (const name of fs.readdirSync(base)) {
    const dir = path.join(base, name);
    let expired = false;
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
      const metaPath = path.join(dir, '.scratch-meta.json');
      if (!fs.existsSync(metaPath)) {
        expired = true;
      } else {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const expiresAt = Date.parse(meta.expiresAt);
        expired = !Number.isFinite(expiresAt) || expiresAt <= now;
      }
      if (!expired) continue;
      if (!dryRun) fs.rmSync(dir, { recursive: true, force: true });
      shredded.push(name);
    } catch {
      errors.push(name);
    }
  }
  return { shredded, errors, dryRun };
}

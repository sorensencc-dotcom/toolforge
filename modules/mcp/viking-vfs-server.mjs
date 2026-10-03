import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createResolver, VikingError } from './viking-resolver.mjs';
import { validateRequest, validateResponse, validateReport, computeVikingReport, formatReportMarkdown } from './viking-vfs-contracts.mjs';
import { readPinnedSnapshot } from './viking-snapshot.mjs';
import { createTierIndex } from './viking-tier-index.mjs';

export const JSON_RPC_CODES = Object.freeze({
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TIER_UNAVAILABLE: -32001,
  SNAPSHOT_UNAVAILABLE: -32002,
  INTEGRITY_FAILED: -32003,
  RESOURCE_LIMIT: -32004,
  VIKING_REPORT_INVALID: -32005,
  READONLY_VIOLATION: -32006,
});

function protocolCode(vikingCode) {
  if (vikingCode === 'METHOD_NOT_FOUND') return JSON_RPC_CODES.METHOD_NOT_FOUND;
  if (vikingCode === 'INVALID_REQUEST') return JSON_RPC_CODES.INVALID_REQUEST;
  if (['INVALID_URI', 'NAMESPACE_REJECTED', 'PATH_TRAVERSAL_REJECTED', 'RESOURCE_NOT_FOUND'].includes(vikingCode)) return JSON_RPC_CODES.INVALID_PARAMS;
  if (vikingCode === 'TIER_UNAVAILABLE') return JSON_RPC_CODES.TIER_UNAVAILABLE;
  if (vikingCode === 'SNAPSHOT_UNAVAILABLE') return JSON_RPC_CODES.SNAPSHOT_UNAVAILABLE;
  if (['MANIFEST_INVALID', 'INTEGRITY_FAILED'].includes(vikingCode)) return JSON_RPC_CODES.INTEGRITY_FAILED;
  if (['RESOURCE_TOO_LARGE', 'BATCH_LIMIT_EXCEEDED'].includes(vikingCode)) return JSON_RPC_CODES.RESOURCE_LIMIT;
  if (vikingCode === 'VIKING_REPORT_INVALID') return JSON_RPC_CODES.VIKING_REPORT_INVALID;
  if (vikingCode === 'READONLY_VIOLATION') return JSON_RPC_CODES.READONLY_VIOLATION;
  return JSON_RPC_CODES.INTERNAL_ERROR;
}

function errorPayload(error, fallbackCode = 'INTERNAL_ERROR') {
  const vikingCode = error instanceof VikingError ? error.code : fallbackCode;
  return { code: protocolCode(vikingCode), message: error?.message || 'Internal error', data: { ...(error instanceof VikingError ? error.data : {}), viking_code: vikingCode } };
}

function requireParams(request) {
  if (!request || typeof request !== 'object' || typeof request.method !== 'string') throw new VikingError('INVALID_REQUEST', 'Request must include a method');
  const params = request.params ?? {};
  if (typeof params !== 'object' || Array.isArray(params)) throw new VikingError('INVALID_REQUEST', 'params must be an object');
  if (
    ![
      'initialize',
      'resources/list',
      'resources_list',
      'tools/list',
      'tools/call',
      'viking/readBatch',
      'viking_read_batch',
      'viking/upsertDocument',
      'vfs_upsert_document',
    ].includes(request.method) &&
    typeof params.uri !== 'string'
  ) {
    throw new VikingError('INVALID_REQUEST', 'uri is required');
  }
  return params;
}

export function toJsonRpcResponse(id, payload) {
  if (payload?.error) return { jsonrpc: '2.0', id: id ?? null, error: payload.error };
  return { jsonrpc: '2.0', id: id ?? null, result: payload };
}

export const VIKING_TOOLS = Object.freeze([
  {
    name: 'vfs_upsert_document',
    description:
      'Writes a document to the physical workspace first, then upserts into the local knowledge cache so the note is immediately discoverable.',
    inputSchema: {
      type: 'object',
      required: ['topic', 'category', 'content'],
      properties: {
        topic: { type: 'string', description: 'Canonical kebab-case topic id' },
        category: {
          type: 'string',
          description: 'Namespace category e.g. research, concepts, utilities'
        },
        content: {
          type: 'string',
          description: 'Full markdown/code including optional YAML frontmatter'
        },
        file_path: {
          type: 'string',
          description: 'Optional relative path; default wiki/{category}/{topic}.md'
        }
      }
    }
  },
  {
    name: 'viking_list',
    description: 'Lists directory entries and L0 summaries at uri.',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource directory URI (viking://...)' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Maximum number of entries to return (<= 100)' },
        mode: { type: 'string', description: 'Optional operational mode (exploration, audit, refactor, hotfix)' }
      }
    }
  },
  {
    name: 'viking_stat',
    description: 'Inspects resource metadata and tier availability for a URI.',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource URI (viking://...)' },
        mode: { type: 'string', description: 'Optional operational mode' }
      }
    }
  },
  {
    name: 'viking_read',
    description: 'Reads resource content at the specified resolution tier (L0, L1, L2).',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource URI (viking://...)' },
        resolution_tier: { type: 'string', enum: ['L0', 'L1', 'L2'], description: 'Resolution tier (L0: abstract, L1: skeleton, L2: full)' },
        mode: { type: 'string', description: 'Optional operational mode' },
        model: { type: 'string', description: 'Optional model identifier for tier suitability' }
      }
    }
  },
  {
    name: 'viking_read_batch',
    description: 'Batch reads multiple Viking resources across resolution tiers.',
    inputSchema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          description: 'Array of items with uri and resolution_tier'
        },
        max_total_bytes: { type: 'integer', description: 'Maximum aggregate response size in bytes' }
      }
    }
  },
  {
    name: 'viking_report',
    description: 'Generates context compaction and token savings report for a resource URI.',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource URI' },
        resolution_tier: { type: 'string', enum: ['L0', 'L1', 'L2'], description: 'Resolution tier' },
        mode: { type: 'string', description: 'Optional operational mode' },
        model: { type: 'string', description: 'Optional model identifier' }
      }
    }
  },
  {
    name: 'resources/list',
    description: 'Standard MCP resource listing without requiring a URI.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: 'Pagination cursor token' }
      }
    }
  },
  {
    name: 'resources/read',
    description: 'Standard MCP resource read by URI.',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Resource URI' }
      }
    }
  },
  {
    name: 'viking_ls',
    description: 'Compatibility alias for viking/list (list directory entries, including L0 abstract when available).',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource directory URI' },
        offset: { type: 'integer', description: 'Pagination offset' },
        limit: { type: 'integer', description: 'Maximum entries to return (<= 100)' },
        mode: { type: 'string', description: 'Optional operational mode' }
      }
    }
  },
  {
    name: 'viking_overview',
    description: 'Compatibility alias for viking/read with default resolution_tier L1 (skeleton view).',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource URI' },
        resolution_tier: { type: 'string', enum: ['L0', 'L1', 'L2'], description: 'Resolution tier (defaults to L1)' },
        mode: { type: 'string', description: 'Optional operational mode' },
        model: { type: 'string', description: 'Optional model identifier' }
      }
    }
  },
  {
    name: 'viking_read_detail',
    description: 'Compatibility alias for viking/read with resolution_tier L2 (full content).',
    inputSchema: {
      type: 'object',
      required: ['uri'],
      properties: {
        uri: { type: 'string', description: 'Viking resource URI' },
        resolution_tier: { type: 'string', enum: ['L0', 'L1', 'L2'], description: 'Resolution tier (defaults to L2)' },
        mode: { type: 'string', description: 'Optional operational mode' },
        model: { type: 'string', description: 'Optional model identifier' }
      }
    }
  }
]);

export function sanitizeTopic(topic) {
  if (topic == null) return '';
  return String(topic)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeRelPath(relPath) {
  return String(relPath).replace(/\\/g, '/').replace(/^\.\//, '');
}

export function resolveSafeWorkspacePath(repoRoot, filePath) {
  if (filePath == null || typeof filePath !== 'string' || !filePath.trim()) {
    throw new VikingError('INVALID_URI', 'file_path must be a non-empty relative path');
  }

  const raw = filePath.trim();
  if (raw.startsWith('/') || raw.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(raw)) {
    throw new VikingError('PATH_TRAVERSAL_REJECTED', `Absolute paths are not allowed: ${raw}`);
  }

  const normalizedInput = normalizeRelPath(raw);
  if (normalizedInput.split('/').some((seg) => seg === '..')) {
    throw new VikingError('PATH_TRAVERSAL_REJECTED', `Path traversal is not allowed: ${raw}`);
  }

  const root = fs.realpathSync(repoRoot);
  const candidate = path.resolve(root, normalizedInput);
  if (!candidate.startsWith(`${root}${path.sep}`) && candidate !== root) {
    throw new VikingError('PATH_TRAVERSAL_REJECTED', `Resolved path escapes repository root: ${raw}`);
  }

  return { relPath: normalizedInput, absPath: candidate };
}

export function executeVfsUpsert(repoRoot, { topic: rawTopic, category: rawCategory, content, file_path }, { readOnly = false } = {}) {
  if (readOnly || process.env.READONLY_VFS === '1' || process.env.VIKING_READONLY === '1') {
    throw new VikingError('READONLY_VIOLATION', 'Write operations are disabled in read-only mode');
  }

  const topic = sanitizeTopic(rawTopic);
  const category = rawCategory != null ? String(rawCategory).trim() : '';

  if (!topic) throw new VikingError('INVALID_PARAMS', 'topic is required and must sanitize to a valid identifier');
  if (!category) throw new VikingError('INVALID_PARAMS', 'category is required');
  if (content == null || typeof content !== 'string') throw new VikingError('INVALID_PARAMS', 'content must be a string');

  const defaultPath = `wiki/${category}/${topic}.md`;
  const requestedPath = file_path != null && String(file_path).trim() ? String(file_path).trim() : defaultPath;
  const { relPath, absPath } = resolveSafeWorkspacePath(repoRoot, requestedPath);

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');

  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return {
    ok: true,
    id: relPath,
    file_path: relPath,
    sha256: hash,
    action: 'upserted',
  };
}

export function createServer(
  resolver,
  {
    telemetry = () => {},
    resourceRootUri = 'viking://kb-sync/wiki',
    maxBatchItems = 32,
    maxBatchBytes = 1024 * 1024,
    repoRoot = process.cwd(),
    readOnly = false,
  } = {}
) {
  return Object.freeze({
    tools: VIKING_TOOLS,
    listTools() {
      return VIKING_TOOLS;
    },
    async handle(request) {
      const started = process.hrtime.bigint();
      try {
        const params = requireParams(request);
        if (request.method === 'initialize') return { protocolVersion: '2025-06-18', capabilities: { resources: { listChanged: false }, tools: {} }, serverInfo: { name: 'viking-vfs', version: '0.2.0' } };
        if (request.method === 'resources/list' || request.method === 'resources_list') {
          const offset = params.cursor === undefined ? 0 : Number.parseInt(params.cursor, 10);
          if (!Number.isInteger(offset) || offset < 0 || (params.cursor !== undefined && String(offset) !== params.cursor)) throw new VikingError('INVALID_URI', 'cursor must be a non-negative integer token');
          const listing = resolver.list(resourceRootUri, { offset, limit: 100 });
          return { resources: listing.files.map((file) => ({ uri: file.uri, name: file.name, description: file.abstract ?? undefined, mimeType: 'text/plain', annotations: { stale: file.stale } })), nextCursor: listing.next_offset === null ? undefined : String(listing.next_offset) };
        }
        if (request.method === 'resources/read' || request.method === 'resources_read') {
          const value = resolver.read(params.uri, 'L1');
          const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
          const report = computeVikingReport({ tier: value.resolution_tier, uri: value.uri, content: value.content, cacheHit: value.cache_hit, latencyMs });
          try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
          telemetry({ event: 'viking.request', method: request.method, snapshot_id: value.snapshot_id, generation_hash: value.generation_hash ?? null, tier: value.resolution_tier, latency_ms: latencyMs, cache_hit: value.cache_hit, report });
          return { contents: [{ uri: value.uri, mimeType: 'text/plain', text: value.content, annotations: { stale: value.stale, snapshot_id: value.snapshot_id, report } }] };
        }
        if (request.method === 'tools/list') {
          return { tools: VIKING_TOOLS };
        }
        if (request.method === 'tools/call') {
          const { name, arguments: args = {} } = params;
          if (name === 'vfs_upsert_document') {
            const result = executeVfsUpsert(repoRoot, args, { readOnly });
            const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
            telemetry({ event: 'viking.tool', tool: name, latency_ms: latencyMs });
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          }
          if (name === 'viking_list' || name === 'viking_ls') {
            const listing = resolver.list(args.uri, args);
            const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
            const report = computeVikingReport({ tier: 'L0', uri: args.uri, content: JSON.stringify(listing.files), cacheHit: true, latencyMs, mode: args.mode });
            try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
            return { content: [{ type: 'text', text: JSON.stringify({ ...listing, report }) }] };
          }
          if (name === 'viking_stat') {
            const statVal = resolver.stat(args.uri);
            const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
            const report = computeVikingReport({ tier: 'L0', uri: statVal.uri, content: '', cacheHit: true, latencyMs, mode: args.mode });
            try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
            return { content: [{ type: 'text', text: JSON.stringify({ ...statVal, report }) }] };
          }
          if (name === 'viking_read' || name === 'viking_overview' || name === 'viking_read_detail') {
            const defaultTier = name === 'viking_read_detail' ? 'L2' : 'L1';
            const tier = args.resolution_tier ?? defaultTier;
            const value = resolver.read(args.uri, tier);
            const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
            const report = computeVikingReport({ tier: value.resolution_tier, uri: value.uri, content: value.content, cacheHit: value.cache_hit, latencyMs, mode: args.mode, model: args.model });
            try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
            return { content: [{ type: 'text', text: JSON.stringify({ ...value, report, markdown_report: formatReportMarkdown(report) }) }] };
          }
          if (name === 'viking_read_batch') {
            if (args.items && args.items.length > maxBatchItems) throw new VikingError('BATCH_LIMIT_EXCEEDED', `Batch exceeds ${maxBatchItems} items`, { max_items: maxBatchItems });
            const byteLimit = Math.min(args.max_total_bytes ?? maxBatchBytes, maxBatchBytes);
            let responseBytes = 0;
            const results = [];
            for (const item of (args.items || [])) {
              try {
                const value = resolver.read(item.uri, item.resolution_tier ?? 'L1');
                const valueBytes = Buffer.byteLength(value.content, 'utf8');
                if (responseBytes + valueBytes > byteLimit) throw new VikingError('BATCH_LIMIT_EXCEEDED', 'Batch response exceeds byte limit', { max_total_bytes: byteLimit });
                responseBytes += valueBytes;
                const report = computeVikingReport({ tier: value.resolution_tier, uri: value.uri, content: value.content, cacheHit: value.cache_hit, latencyMs: 0 });
                validateReport(report);
                results.push({ uri: item.uri, result: { ...value, report } });
              } catch (error) {
                results.push({ uri: item.uri, error: errorPayload(error) });
              }
            }
            return { content: [{ type: 'text', text: JSON.stringify({ snapshot_id: resolver.snapshotId, results }) }] };
          }
          if (name === 'viking_report') {
            const tier = args.resolution_tier ?? 'L1';
            let content = '';
            try { content = resolver.read(args.uri, tier).content; } catch {}
            const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
            const report = computeVikingReport({ tier, uri: args.uri, content, cacheHit: true, latencyMs, mode: args.mode, model: args.model });
            try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
            return { content: [{ type: 'text', text: JSON.stringify({ report, markdown_report: formatReportMarkdown(report) }) }] };
          }
          if (name === 'resources/list' || name === 'resources_list') {
            const offset = args.cursor === undefined ? 0 : Number.parseInt(args.cursor, 10);
            if (!Number.isInteger(offset) || offset < 0 || (args.cursor !== undefined && String(offset) !== args.cursor)) throw new VikingError('INVALID_URI', 'cursor must be a non-negative integer token');
            const listing = resolver.list(resourceRootUri, { offset, limit: 100 });
            const resObj = { resources: listing.files.map((file) => ({ uri: file.uri, name: file.name, description: file.abstract ?? undefined, mimeType: 'text/plain', annotations: { stale: file.stale } })), nextCursor: listing.next_offset === null ? undefined : String(listing.next_offset) };
            return { content: [{ type: 'text', text: JSON.stringify(resObj) }] };
          }
          if (name === 'resources/read' || name === 'resources_read') {
            const value = resolver.read(args.uri, 'L1');
            const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
            const report = computeVikingReport({ tier: value.resolution_tier, uri: value.uri, content: value.content, cacheHit: value.cache_hit, latencyMs });
            try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
            const resObj = { contents: [{ uri: value.uri, mimeType: 'text/plain', text: value.content, annotations: { stale: value.stale, snapshot_id: value.snapshot_id, report } }] };
            return { content: [{ type: 'text', text: JSON.stringify(resObj) }] };
          }
          throw new VikingError('METHOD_NOT_FOUND', `Unknown tool: ${name}`);
        }
        if (request.method === 'viking/upsertDocument' || request.method === 'vfs_upsert_document') {
          const result = executeVfsUpsert(repoRoot, params, { readOnly });
          const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
          telemetry({ event: 'viking.upsert', latency_ms: latencyMs });
          return result;
        }
        if (request.method === 'viking/stat' || request.method === 'viking_stat') {
          const statVal = resolver.stat(params.uri);
          const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
          const report = computeVikingReport({ tier: 'L0', uri: statVal.uri, content: '', cacheHit: true, latencyMs, mode: params.mode });
          try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
          return { ...statVal, report };
        }
        if (request.method === 'viking/list' || request.method === 'viking_list' || request.method === 'viking_ls') {
          const listing = resolver.list(params.uri, params);
          const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
          const report = computeVikingReport({ tier: 'L0', uri: params.uri, content: JSON.stringify(listing.files), cacheHit: true, latencyMs, mode: params.mode });
          try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
          return { ...listing, report };
        }
        if (request.method === 'viking/read' || request.method === 'viking_read' || request.method === 'viking_overview' || request.method === 'viking_read_detail') {
          const defaultTier = request.method === 'viking_read_detail' ? 'L2' : 'L1';
          const tier = params.resolution_tier ?? defaultTier;
          const value = resolver.read(params.uri, tier);
          const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
          const report = computeVikingReport({ tier: value.resolution_tier, uri: value.uri, content: value.content, cacheHit: value.cache_hit, latencyMs, mode: params.mode, model: params.model });
          try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
          telemetry({ event: 'viking.request', method: request.method, snapshot_id: value.snapshot_id, generation_hash: value.generation_hash ?? null, tier: value.resolution_tier, latency_ms: latencyMs, cache_hit: value.cache_hit, report });
          return { ...value, report, markdown_report: formatReportMarkdown(report) };
        }
        if (request.method === 'viking/readBatch' || request.method === 'viking_read_batch') {
          if (params.items.length > maxBatchItems) throw new VikingError('BATCH_LIMIT_EXCEEDED', `Batch exceeds ${maxBatchItems} items`, { max_items: maxBatchItems });
          const byteLimit = Math.min(params.max_total_bytes ?? maxBatchBytes, maxBatchBytes);
          let responseBytes = 0;
          const results = [];
          for (const item of params.items) {
            try {
              const value = resolver.read(item.uri, item.resolution_tier ?? 'L1');
              const valueBytes = Buffer.byteLength(value.content, 'utf8');
              if (responseBytes + valueBytes > byteLimit) throw new VikingError('BATCH_LIMIT_EXCEEDED', 'Batch response exceeds byte limit', { max_total_bytes: byteLimit });
              responseBytes += valueBytes;
              const report = computeVikingReport({ tier: value.resolution_tier, uri: value.uri, content: value.content, cacheHit: value.cache_hit, latencyMs: 0 });
              validateReport(report);
              results.push({ uri: item.uri, result: { ...value, report } });
            } catch (error) {
              results.push({ uri: item.uri, error: errorPayload(error) });
            }
          }
          telemetry({ event: 'viking.batch', method: request.method, snapshot_id: resolver.snapshotId, item_count: params.items.length, success_count: results.filter((item) => item.result).length, error_count: results.filter((item) => item.error).length, response_bytes: responseBytes, latency_ms: Number(process.hrtime.bigint() - started) / 1e6 });
          return { snapshot_id: resolver.snapshotId, results };
        }
        if (request.method === 'viking/report' || request.method === 'viking_report') {
          const tier = params.resolution_tier ?? 'L1';
          let content = '';
          try { content = resolver.read(params.uri, tier).content; } catch {}
          const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
          const report = computeVikingReport({ tier, uri: params.uri, content, cacheHit: true, latencyMs, mode: params.mode, model: params.model });
          try { validateReport(report); } catch (err) { throw new VikingError('VIKING_REPORT_INVALID', `Viking VFS reporting payload failed schema validation: ${err.message}`); }
          return { report, markdown_report: formatReportMarkdown(report) };
        }
        throw new VikingError('METHOD_NOT_FOUND', `Unsupported method: ${request.method}`);
      } catch (error) {
        const vikingCode = error instanceof VikingError ? error.code : 'INTERNAL_ERROR';
        telemetry({ event: 'viking.error', method: request?.method ?? null, error_code: vikingCode, latency_ms: Number(process.hrtime.bigint() - started) / 1e6 });
        return { error: errorPayload(error) };
      }
    },
  });
}

export const createVikingVfsServer = createServer;

export async function processJsonRpcLine(line, server) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    return { jsonrpc: '2.0', id: null, error: { code: JSON_RPC_CODES.PARSE_ERROR, message: 'Parse error', data: { viking_code: 'PARSE_ERROR' } } };
  }
  try {
    validateRequest(request);
  } catch (error) {
    const isMethod = error?.path === '$.method';
    const isParams = error?.path?.startsWith('$.params');
    const vikingCode = isMethod ? 'METHOD_NOT_FOUND' : isParams ? 'INVALID_URI' : 'INVALID_REQUEST';
    return { jsonrpc: '2.0', id: request?.id ?? null, error: { code: isMethod ? JSON_RPC_CODES.METHOD_NOT_FOUND : isParams ? JSON_RPC_CODES.INVALID_PARAMS : JSON_RPC_CODES.INVALID_REQUEST, message: error.message, data: { viking_code: vikingCode, path: error.path ?? '$' } } };
  }
  const response = toJsonRpcResponse(request.id, await server.handle(request));
  validateResponse(response, { method: request.method });
  return response;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const vaultRoot = process.env.VIKING_VAULT_ROOT;
  const vaultName = process.env.VIKING_VAULT_NAME ?? 'kb-sync';
  const pinned = process.env.VIKING_SNAPSHOT_ID ? null : readPinnedSnapshot({ vaultRoot });
  const snapshotId = process.env.VIKING_SNAPSHOT_ID ?? pinned.snapshotId;
  const tierIndexPath = process.env.VIKING_TIER_INDEX ?? (pinned ? `${pinned.snapshotRoot}/tier-index.sqlite` : null);
  const tierIndex = tierIndexPath ? createTierIndex({ filename: tierIndexPath, readonly: true }) : {};
  const resolver = createResolver({ vaultRoot, vaultName, snapshotId, snapshotRoot: pinned?.snapshotRoot, snapshotManifest: pinned?.manifest, tierIndex, layerRoots: { sources: 'sources', wiki: 'wiki', schema: 'schema' } });
  const server = createServer(resolver, { readOnly: process.env.READONLY_VFS === '1' || process.env.VIKING_READONLY === '1' });
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async (line) => {
    const response = await processJsonRpcLine(line, server);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}



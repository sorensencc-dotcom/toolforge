import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { createResolver, VikingError } from './viking-resolver.mjs';
import { validateRequest, validateResponse } from './viking-vfs-contracts.mjs';
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
});

function protocolCode(vikingCode) {
  if (vikingCode === 'METHOD_NOT_FOUND') return JSON_RPC_CODES.METHOD_NOT_FOUND;
  if (vikingCode === 'INVALID_REQUEST') return JSON_RPC_CODES.INVALID_REQUEST;
  if (['INVALID_URI', 'NAMESPACE_REJECTED', 'PATH_TRAVERSAL_REJECTED', 'RESOURCE_NOT_FOUND'].includes(vikingCode)) return JSON_RPC_CODES.INVALID_PARAMS;
  if (vikingCode === 'TIER_UNAVAILABLE') return JSON_RPC_CODES.TIER_UNAVAILABLE;
  if (vikingCode === 'SNAPSHOT_UNAVAILABLE') return JSON_RPC_CODES.SNAPSHOT_UNAVAILABLE;
  if (['MANIFEST_INVALID', 'INTEGRITY_FAILED'].includes(vikingCode)) return JSON_RPC_CODES.INTEGRITY_FAILED;
  if (['RESOURCE_TOO_LARGE', 'BATCH_LIMIT_EXCEEDED'].includes(vikingCode)) return JSON_RPC_CODES.RESOURCE_LIMIT;
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
  if (!['initialize', 'resources/list', 'viking/readBatch'].includes(request.method) && typeof params.uri !== 'string') throw new VikingError('INVALID_REQUEST', 'uri is required');
  return params;
}

export function toJsonRpcResponse(id, payload) {
  if (payload?.error) return { jsonrpc: '2.0', id: id ?? null, error: payload.error };
  return { jsonrpc: '2.0', id: id ?? null, result: payload };
}

export function createServer(resolver, { telemetry = () => {}, resourceRootUri = 'viking://kb-sync/wiki', maxBatchItems = 32, maxBatchBytes = 1024 * 1024 } = {}) {
  return Object.freeze({
    async handle(request) {
      const started = process.hrtime.bigint();
      try {
        const params = requireParams(request);
        if (request.method === 'initialize') return { protocolVersion: '2025-06-18', capabilities: { resources: { listChanged: false } }, serverInfo: { name: 'viking-vfs', version: '0.2.0' } };
        if (request.method === 'resources/list') { const offset = params.cursor === undefined ? 0 : Number.parseInt(params.cursor, 10); if (!Number.isInteger(offset) || offset < 0 || (params.cursor !== undefined && String(offset) !== params.cursor)) throw new VikingError('INVALID_URI', 'cursor must be a non-negative integer token'); const listing = resolver.list(resourceRootUri, { offset, limit: 100 }); return { resources: listing.files.map((file) => ({ uri: file.uri, name: file.name, description: file.abstract ?? undefined, mimeType: 'text/plain', annotations: { stale: file.stale } })), nextCursor: listing.next_offset === null ? undefined : String(listing.next_offset) }; }
        if (request.method === 'resources/read') { const value = resolver.read(params.uri, 'L1'); telemetry({ event: 'viking.request', method: request.method, snapshot_id: value.snapshot_id, generation_hash: value.generation_hash ?? null, tier: value.resolution_tier, latency_ms: Number(process.hrtime.bigint() - started) / 1e6, cache_hit: value.cache_hit }); return { contents: [{ uri: value.uri, mimeType: 'text/plain', text: value.content, annotations: { stale: value.stale, snapshot_id: value.snapshot_id } }] }; }
        if (request.method === 'viking/stat') return resolver.stat(params.uri);
        if (request.method === 'viking/list') return resolver.list(params.uri, params);
        if (request.method === 'viking/read') { const value = resolver.read(params.uri, params.resolution_tier ?? 'L1'); telemetry({ event: 'viking.request', method: request.method, snapshot_id: value.snapshot_id, generation_hash: value.generation_hash ?? null, tier: value.resolution_tier, latency_ms: Number(process.hrtime.bigint() - started) / 1e6, cache_hit: value.cache_hit }); return value; }
        if (request.method === 'viking/readBatch') {
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
              results.push({ uri: item.uri, result: value });
            } catch (error) {
              results.push({ uri: item.uri, error: errorPayload(error) });
            }
          }
          telemetry({ event: 'viking.batch', method: request.method, snapshot_id: resolver.snapshotId, item_count: params.items.length, success_count: results.filter((item) => item.result).length, error_count: results.filter((item) => item.error).length, response_bytes: responseBytes, latency_ms: Number(process.hrtime.bigint() - started) / 1e6 });
          return { snapshot_id: resolver.snapshotId, results };
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const vaultRoot = process.env.VIKING_VAULT_ROOT;
  const vaultName = process.env.VIKING_VAULT_NAME ?? 'kb-sync';
  const pinned = process.env.VIKING_SNAPSHOT_ID ? null : readPinnedSnapshot({ vaultRoot });
  const snapshotId = process.env.VIKING_SNAPSHOT_ID ?? pinned.snapshotId;
  const tierIndexPath = process.env.VIKING_TIER_INDEX ?? (pinned ? `${pinned.snapshotRoot}/tier-index.sqlite` : null);
  const tierIndex = tierIndexPath ? createTierIndex({ filename: tierIndexPath, readonly: true }) : {};
  const resolver = createResolver({ vaultRoot, vaultName, snapshotId, snapshotRoot: pinned?.snapshotRoot, snapshotManifest: pinned?.manifest, tierIndex, layerRoots: { sources: 'sources', wiki: 'wiki', schema: 'schema' } });
  const server = createServer(resolver);
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async (line) => {
    const response = await processJsonRpcLine(line, server);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

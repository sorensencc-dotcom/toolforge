import readline from 'node:readline';
import { createResolver, VikingError } from './viking-resolver.mjs';

function requireParams(request) {
  if (!request || typeof request !== 'object' || typeof request.method !== 'string') throw new VikingError('INVALID_REQUEST', 'Request must include a method');
  const params = request.params ?? {};
  if (typeof params !== 'object' || Array.isArray(params)) throw new VikingError('INVALID_REQUEST', 'params must be an object');
  if (request.method !== 'initialize' && typeof params.uri !== 'string') throw new VikingError('INVALID_REQUEST', 'uri is required');
  return params;
}

export function toJsonRpcResponse(id, payload) {
  if (payload?.error) return { jsonrpc: '2.0', id: id ?? null, error: payload.error };
  return { jsonrpc: '2.0', id: id ?? null, result: payload };
}

export function createServer(resolver) {
  return Object.freeze({
    async handle(request) {
      try {
        const params = requireParams(request);
        if (request.method === 'initialize') return { protocolVersion: '2025-06-18', capabilities: { resources: { listChanged: false } }, serverInfo: { name: 'viking-vfs', version: '0.1.0' } };
        if (request.method === 'resources/list') return resolver.list(params.uri ?? 'viking://kb-sync/wiki', params);
        if (request.method === 'resources/read') return { contents: [{ uri: params.uri, mimeType: 'text/plain', text: resolver.read(params.uri, params.resolution_tier ?? 'L1').content }] };
        if (request.method === 'viking/stat') return resolver.stat(params.uri);
        if (request.method === 'viking/list') return resolver.list(params.uri, params);
        if (request.method === 'viking/read') return resolver.read(params.uri, params.resolution_tier ?? 'L1');
        throw new VikingError('METHOD_NOT_FOUND', `Unsupported method: ${request.method}`);
      } catch (error) {
        const code = error instanceof VikingError ? error.code : 'INTERNAL_ERROR';
        return { error: { code, message: error.message, data: error instanceof VikingError ? error.data : {} } };
      }
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultRoot = process.env.VIKING_VAULT_ROOT;
  const vaultName = process.env.VIKING_VAULT_NAME ?? 'kb-sync';
  const snapshotId = process.env.VIKING_SNAPSHOT_ID;
  const resolver = createResolver({ vaultRoot, vaultName, snapshotId, layerRoots: { sources: 'sources', wiki: 'wiki', schema: 'schema' } });
  const server = createServer(resolver);
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async (line) => {
    const request = JSON.parse(line);
    const result = await server.handle(request);
    process.stdout.write(`${JSON.stringify(toJsonRpcResponse(request.id, result))}\n`);
  });
}

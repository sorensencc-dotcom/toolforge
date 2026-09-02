const METHODS = Object.freeze(['initialize', 'resources/list', 'resources/read', 'viking/list', 'viking/stat', 'viking/read', 'viking/readBatch']);
const TIERS = Object.freeze(['L0', 'L1', 'L2']);
const MAX_BATCH_ITEMS = 32;

export const CONTRACT_VERSION = '1.1.0';

export class ContractValidationError extends Error {
  constructor(message, path = '$') {
    super(message);
    this.name = 'ContractValidationError';
    this.path = path;
  }
}

function fail(message, path) {
  throw new ContractValidationError(message, path);
}

function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('must be an object', path);
  return value;
}

function string(value, path, { nonEmpty = true } = {}) {
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) fail('must be a non-empty string', path);
  return value;
}

function integer(value, path, { min = 0 } = {}) {
  if (!Number.isInteger(value) || value < min) fail(`must be an integer >= ${min}`, path);
  return value;
}

function number(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('must be a finite number', path);
  return value;
}

function noUnknown(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`unknown property: ${key}`, `${path}.${key}`);
}

function uri(value, path) {
  string(value, path);
  if (!value.startsWith('viking://')) fail('must use viking:// scheme', path);
  return value;
}

function validateParams(method, params) {
  object(params, '$.params');
  if (method === 'initialize') {
    noUnknown(params, ['protocolVersion', 'capabilities', 'clientInfo'], '$.params');
    if ('protocolVersion' in params) string(params.protocolVersion, '$.params.protocolVersion');
    return params;
  }
  if (method === 'resources/list') { noUnknown(params, ['cursor'], '$.params'); if ('cursor' in params) string(params.cursor, '$.params.cursor'); return params; }
  if (method === 'viking/readBatch') {
    noUnknown(params, ['items', 'max_total_bytes'], '$.params');
    if (!Array.isArray(params.items) || params.items.length < 1 || params.items.length > MAX_BATCH_ITEMS) fail(`items must contain 1-${MAX_BATCH_ITEMS} entries`, '$.params.items');
    params.items.forEach((item, index) => {
      object(item, `$.params.items[${index}]`);
      noUnknown(item, ['uri', 'resolution_tier'], `$.params.items[${index}]`);
      uri(item.uri, `$.params.items[${index}].uri`);
      if ('resolution_tier' in item && !TIERS.includes(item.resolution_tier)) fail('must be L0, L1, or L2', `$.params.items[${index}].resolution_tier`);
    });
    if ('max_total_bytes' in params) integer(params.max_total_bytes, '$.params.max_total_bytes', { min: 1 });
    return params;
  }
  uri(params.uri, '$.params.uri');
  if (method === 'resources/read') { noUnknown(params, ['uri'], '$.params'); return params; }
  if (method === 'viking/list') {
    noUnknown(params, ['uri', 'offset', 'limit'], '$.params');
    if ('offset' in params) integer(params.offset, '$.params.offset');
    if ('limit' in params) integer(params.limit, '$.params.limit', { min: 1 });
    if (params.limit > 100) fail('must be <= 100', '$.params.limit');
  } else if (method === 'viking/read') {
    noUnknown(params, ['uri', 'resolution_tier'], '$.params');
    if ('resolution_tier' in params && !TIERS.includes(params.resolution_tier)) fail('must be L0, L1, or L2', '$.params.resolution_tier');
  } else {
    noUnknown(params, ['uri'], '$.params');
  }
  return params;
}

export function validateRequest(request) {
  const value = object(request, '$');
  noUnknown(value, ['jsonrpc', 'id', 'method', 'params'], '$');
  if (value.jsonrpc !== '2.0') fail('must equal 2.0', '$.jsonrpc');
  if (!('id' in value) || (value.id !== null && !['string', 'number'].includes(typeof value.id))) fail('must be string, number, or null', '$.id');
  if (!METHODS.includes(value.method)) fail('unsupported method', '$.method');
  validateParams(value.method, value.params ?? {});
  return value;
}

function validateResult(result, method) {
  object(result, '$.result');
  if (method === 'initialize') {
    string(result.protocolVersion, '$.result.protocolVersion');
    object(result.capabilities, '$.result.capabilities');
    object(result.serverInfo, '$.result.serverInfo');
    return result;
  }
  if (method === 'resources/list') {
    if (!Array.isArray(result.resources)) fail('resources must be an array', '$.result.resources');
    return result;
  }
  if (method === 'resources/read') {
    if (!Array.isArray(result.contents)) fail('contents must be an array', '$.result.contents');
    return result;
  }
  if (method === 'viking/readBatch') {
    string(result.snapshot_id, '$.result.snapshot_id');
    if (!Array.isArray(result.results)) fail('results must be an array', '$.result.results');
    return result;
  }
  string(result.uri, '$.result.uri');
  string(result.snapshot_id, '$.result.snapshot_id');
  return result;
}

export function validateResponse(response, { method } = {}) {
  const value = object(response, '$');
  noUnknown(value, ['jsonrpc', 'id', 'result', 'error'], '$');
  if (value.jsonrpc !== '2.0') fail('must equal 2.0', '$.jsonrpc');
  if (!('id' in value) || (value.id !== null && !['string', 'number'].includes(typeof value.id))) fail('must be string, number, or null', '$.id');
  if (('result' in value) === ('error' in value)) fail('must contain exactly one of result or error', '$');
  if ('result' in value) return validateResult(value.result, method);
  const error = object(value.error, '$.error');
  noUnknown(error, ['code', 'message', 'data'], '$.error');
  number(error.code, '$.error.code');
  string(error.message, '$.error.message');
  if ('data' in error) object(error.data, '$.error.data');
  return error;
}

export const VikingVfsContract = Object.freeze({
  version: CONTRACT_VERSION,
  methods: METHODS,
  tiers: TIERS,
  validateRequest,
  validateResponse,
});

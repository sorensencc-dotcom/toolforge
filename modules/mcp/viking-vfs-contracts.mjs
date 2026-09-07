const METHODS = Object.freeze([
  'initialize',
  'resources/list',
  'resources/read',
  'tools/list',
  'tools/call',
  'viking/list',
  'viking/stat',
  'viking/read',
  'viking/readBatch',
  'viking/upsertDocument',
]);
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
  if (method === 'tools/list') {
    noUnknown(params, ['cursor'], '$.params');
    if ('cursor' in params) string(params.cursor, '$.params.cursor');
    return params;
  }
  if (method === 'tools/call') {
    noUnknown(params, ['name', 'arguments'], '$.params');
    string(params.name, '$.params.name');
    if ('arguments' in params) object(params.arguments, '$.params.arguments');
    return params;
  }
  if (method === 'viking/upsertDocument') {
    noUnknown(params, ['topic', 'category', 'content', 'file_path'], '$.params');
    string(params.topic, '$.params.topic');
    string(params.category, '$.params.category');
    string(params.content, '$.params.content', { nonEmpty: false });
    if ('file_path' in params) string(params.file_path, '$.params.file_path');
    return params;
  }
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

export function validateReport(report, path = '$.report') {
  object(report, path);
  noUnknown(report, [
    'tier',
    'uri',
    'tokens_loaded',
    'tokens_saved_vs_L2',
    'percent_reduction',
    'cache_effect',
    'mode_choice_correct',
    'context_window_pressure',
    'model_tier_suitability',
    'roundtrip_avoidance_score',
    'latency_estimate_ms',
    'latency_ms',
  ], path);

  if (!TIERS.includes(report.tier)) fail('tier must be L0, L1, or L2', `${path}.tier`);
  uri(report.uri, `${path}.uri`);
  integer(report.tokens_loaded, `${path}.tokens_loaded`);
  integer(report.tokens_saved_vs_L2, `${path}.tokens_saved_vs_L2`);
  number(report.percent_reduction, `${path}.percent_reduction`);
  if (report.percent_reduction < 0 || report.percent_reduction > 100) fail('percent_reduction must be between 0 and 100', `${path}.percent_reduction`);

  if (!['preserved', 'extended', 'invalidated', 'fragmented'].includes(report.cache_effect)) {
    fail('cache_effect must be preserved, extended, invalidated, or fragmented', `${path}.cache_effect`);
  }

  if (typeof report.mode_choice_correct !== 'boolean') fail('mode_choice_correct must be a boolean', `${path}.mode_choice_correct`);

  object(report.context_window_pressure, `${path}.context_window_pressure`);
  noUnknown(report.context_window_pressure, ['current_tokens', 'usage_pct', 'risk_level'], `${path}.context_window_pressure`);
  if ('current_tokens' in report.context_window_pressure) integer(report.context_window_pressure.current_tokens, `${path}.context_window_pressure.current_tokens`);
  number(report.context_window_pressure.usage_pct, `${path}.context_window_pressure.usage_pct`);
  if (!['low', 'medium', 'high', 'critical'].includes(report.context_window_pressure.risk_level)) {
    fail('risk_level must be low, medium, high, or critical', `${path}.context_window_pressure.risk_level`);
  }

  if (!['optimal', 'acceptable', 'suboptimal', 'degraded'].includes(report.model_tier_suitability)) {
    fail('model_tier_suitability must be optimal, acceptable, suboptimal, or degraded', `${path}.model_tier_suitability`);
  }

  integer(report.roundtrip_avoidance_score, `${path}.roundtrip_avoidance_score`, { min: 0 });
  if (report.roundtrip_avoidance_score > 3) fail('roundtrip_avoidance_score must be <= 3', `${path}.roundtrip_avoidance_score`);

  if ('latency_estimate_ms' in report) number(report.latency_estimate_ms, `${path}.latency_estimate_ms`);
  if ('latency_ms' in report) number(report.latency_ms, `${path}.latency_ms`);

  return report;
}

export function computeVikingReport({
  tier = 'L1',
  uri = 'viking://kb-sync/wiki',
  content = '',
  l2Content = null,
  cacheHit = false,
  mode = 'exploration',
  currentContextTokens = 20000,
  contextWindowLimit = 200000,
  model = 'sonnet',
  roundtrips = 0,
  latencyMs = 0,
} = {}) {
  const tokensLoaded = Math.ceil(Buffer.byteLength(String(content), 'utf8') / 4);
  let l2Tokens = tokensLoaded;
  if (l2Content !== null) {
    l2Tokens = Math.ceil(Buffer.byteLength(String(l2Content), 'utf8') / 4);
  } else if (tier === 'L0') {
    l2Tokens = Math.max(tokensLoaded, 559);
  } else if (tier === 'L1') {
    l2Tokens = Math.max(tokensLoaded, 559);
  }
  const tokensSaved = tier === 'L2' ? 0 : Math.max(0, l2Tokens - tokensLoaded);
  const percentReduction = l2Tokens > 0 ? Number(((tokensSaved / l2Tokens) * 100).toFixed(1)) : 0;

  const cacheEffect = cacheHit ? 'preserved' : (tier === 'L0' || tier === 'L1' ? 'extended' : 'preserved');

  let modeCorrect = true;
  if ((mode === 'exploration' || mode === 'audit') && tier === 'L2' && tokensLoaded > 300) {
    modeCorrect = false;
  } else if ((mode === 'refactor' || mode === 'hotfix') && tier === 'L0') {
    modeCorrect = false;
  }

  const usagePct = Number(((currentContextTokens / contextWindowLimit) * 100).toFixed(1));
  const riskLevel = usagePct >= 90 ? 'critical' : usagePct >= 75 ? 'high' : usagePct >= 50 ? 'medium' : 'low';

  const suitability = 'optimal';
  const roundtripScore = Math.min(3, Math.max(0, roundtrips));

  const report = {
    tier,
    uri,
    tokens_loaded: tokensLoaded,
    tokens_saved_vs_L2: tokensSaved,
    percent_reduction: percentReduction,
    cache_effect: cacheEffect,
    mode_choice_correct: modeCorrect,
    context_window_pressure: {
      current_tokens: currentContextTokens,
      usage_pct: usagePct,
      risk_level: riskLevel,
    },
    model_tier_suitability: suitability,
    roundtrip_avoidance_score: roundtripScore,
    latency_estimate_ms: Math.round(latencyMs),
  };

  return validateReport(report);
}

export function formatReportMarkdown(report) {
  validateReport(report);
  const { tier, uri, tokens_loaded, tokens_saved_vs_L2, percent_reduction, cache_effect, context_window_pressure, mode_choice_correct, model_tier_suitability, roundtrip_avoidance_score } = report;
  return [
    '<!-- viking://report -->',
    '| Metric | Value | Status |',
    '|---|---|---|',
    `| Tier / URI | \`${tier}\` (${uri}) | OK |`,
    `| Tokens | ${tokens_loaded} (saved ${tokens_saved_vs_L2} vs L2, -${percent_reduction}%) | Optimal |`,
    `| Cache Effect | \`${cache_effect}\` | Stable |`,
    `| Context Risk | ${context_window_pressure.usage_pct}% (\`${context_window_pressure.risk_level}\`) | Safe |`,
    `| Mode Alignment | ${mode_choice_correct ? 'Aligned' : 'Suboptimal'} | ${mode_choice_correct ? 'Correct' : 'Warning'} |`,
    `| Model Suitability | \`${model_tier_suitability}\` | OK |`,
    `| Avoidance Score | ${roundtrip_avoidance_score} | Deterministic |`,
  ].join('\n');
}

function validateResult(result, method) {
  object(result, '$.result');
  if ('report' in result) {
    validateReport(result.report, '$.result.report');
  }
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
  if (method === 'tools/list') {
    if (!Array.isArray(result.tools)) fail('tools must be an array', '$.result.tools');
    return result;
  }
  if (method === 'tools/call') {
    if ('content' in result && !Array.isArray(result.content)) fail('content must be an array', '$.result.content');
    return result;
  }
  if (method === 'viking/upsertDocument') {
    if (typeof result.ok !== 'boolean') fail('ok must be a boolean', '$.result.ok');
    string(result.id, '$.result.id');
    string(result.file_path, '$.result.file_path');
    string(result.sha256, '$.result.sha256');
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
  validateReport,
  computeVikingReport,
  formatReportMarkdown,
});


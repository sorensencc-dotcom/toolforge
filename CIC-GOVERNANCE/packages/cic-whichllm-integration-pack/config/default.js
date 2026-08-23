/**
 * Default Configuration
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Import and spread over your runtime config to get sane CIC-compliant defaults.
 * Override any field; defaults are designed to be safe and spec-compliant.
 */

export const DEFAULT_ADAPTER_CONFIG = {
  harvesterId: process.env.CIC_HARVESTER_ID ?? 'cic-whichllm-default-v1',
  apiEndpoint: process.env.WHICHLLM_API_ENDPOINT ?? 'https://api.whichllm.io',
  // apiKey: MUST be supplied at runtime via process.env.WHICHLLM_API_KEY — never hard-code
  tenantId: process.env.CIC_TENANT_ID ?? null,
  timeoutMs: parseInt(process.env.CIC_TIMEOUT_MS ?? '30000', 10),
  maxRetries: parseInt(process.env.CIC_MAX_RETRIES ?? '3', 10),
  strictMode: (process.env.CIC_STRICT_MODE ?? 'true') === 'true',
};

export const DEFAULT_GOVERNANCE_OPTS = {
  strictMode: (process.env.CIC_STRICT_MODE ?? 'true') === 'true',
  customChecks: [],
};

export const DEFAULT_OBSERVER_OPTS = {
  port: parseInt(process.env.CIC_OBSERVER_PORT ?? '9090', 10),
};

/** Merge helper — spreads defaults, then overrides, never mutates either. */
export function mergeConfig(defaults, overrides) {
  return Object.assign({}, defaults, overrides);
}

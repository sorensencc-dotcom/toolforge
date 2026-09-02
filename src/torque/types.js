/**
 * TorqueQuery Protocol & Conformance Types
 * Defines the request/response contracts, error taxonomy, and eligibility rules.
 */

export const TORQUE_ERROR_CODES = {
  EMPTY_QUERY: 'EMPTY_QUERY',
  BAD_LIMIT: 'BAD_LIMIT',
  BAD_REQUEST: 'BAD_REQUEST',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GOVERNANCE_VIOLATION: 'GOVERNANCE_VIOLATION',
};

export class TorqueQueryError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, any>} [details]
   */
  constructor(code, message, details = {}) {
    super(`[${code}] ${message}`);
    this.name = 'TorqueQueryError';
    this.code = code;
    this.details = details;
  }
}

export const TORQUE_DEFAULTS = {
  TOP_K: 10,
  MAX_TOP_K: 1000,
  CANDIDATE_POOL: 50,
  EMBEDDING_DIM: 4096,
  VERSION: '2.1.0',
  SERVICE_NAME: 'torquequery-memory-drift-search',
};

/**
 * CIC Governance Wrapper Binding
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 * Pack: CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Implements the five mandatory CIC governance checks defined in §2/S3-A1:
 *   GC-01  Harvester Registration Integrity
 *   GC-02  Payload Schema Compliance
 *   GC-03  Prompt Policy Gate
 *   GC-04  Model Allowlist Enforcement
 *   GC-05  Attestation Completeness
 *
 * All check IDs, names, and result literals are canonical; do NOT rename.
 */

import { createHash } from 'node:crypto';
import { deriveId, canonicalJson } from '../adapter/whichllm-adapter.js';
import { HARVESTER_REGISTRY } from '../harvester/harvester-registry.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const GOVERNANCE_VERSION = '1.0.0';
const CIC_SPEC = '2.4.0';
const AMENDMENT = '§2/S3-A1';

/** Maximum prompt length enforced by §2/S3-A1 policy gate */
const MAX_PROMPT_BYTES = 131_072;

/** Model families explicitly allowed under the CIC governance policy */
export const MODEL_ALLOWLIST = new Set([
  'gpt-4',
  'gpt-4o',
  'gpt-4-turbo',
  'claude-3',
  'claude-3.5',
  'gemini-1.5',
  'gemini-2',
  'llama-3',
  'mistral-large',
  'command-r-plus',
  'whichllm-auto', // WHICHLLM native auto-routing token
]);

// ─── Check Definitions ────────────────────────────────────────────────────────

const CHECKS = {
  GC_01: { checkId: 'GC-01', name: 'Harvester Registration Integrity' },
  GC_02: { checkId: 'GC-02', name: 'Payload Schema Compliance' },
  GC_03: { checkId: 'GC-03', name: 'Prompt Policy Gate' },
  GC_04: { checkId: 'GC-04', name: 'Model Allowlist Enforcement' },
  GC_05: { checkId: 'GC-05', name: 'Attestation Completeness' },
};

// ─── GovernanceWrapper ────────────────────────────────────────────────────────

export class GovernanceWrapper {
  #harvesterId;
  #specVersion;
  #amendmentRef;
  #strictMode;
  #customChecks;

  /**
   * @param {object} opts
   * @param {string}   opts.harvesterId
   * @param {string}   opts.specVersion
   * @param {string}   opts.amendmentRef
   * @param {boolean}  [opts.strictMode=true]  - When true, 'fail' blocks execution
   * @param {Function[]} [opts.customChecks=[]] - Additional check functions (same sig as built-ins)
   */
  constructor(opts) {
    const required = ['harvesterId', 'specVersion', 'amendmentRef'];
    for (const k of required) {
      if (!opts[k]) throw new Error(`GovernanceWrapper: missing required option '${k}'`);
    }
    this.#harvesterId = opts.harvesterId;
    this.#specVersion = opts.specVersion;
    this.#amendmentRef = opts.amendmentRef;
    this.#strictMode = opts.strictMode ?? true;
    this.#customChecks = opts.customChecks ?? [];
  }

  /**
   * Pre-flight check — runs before the WHICHLLM request is dispatched.
   * Throws in strictMode if any check fails.
   *
   * @param {import('../adapter/whichllm-adapter.js').WhichLLMQuery} query
   * @returns {Promise<GovernanceCheckResult[]>}
   */
  async preCheck(query) {
    const checks = await Promise.all([
      this.#runGC01(),
      this.#runGC02(query),
      this.#runGC03(query),
    ]);

    for (const c of checks) {
      if (c.result === 'fail' && this.#strictMode) {
        throw new GovernanceViolationError(c);
      }
    }

    return checks;
  }

  /**
   * Post-flight attestation — runs after a successful WHICHLLM response.
   * Returns a signed attestation envelope included in the ingestion record.
   *
   * @param {object} ctx
   * @param {object} ctx.query
   * @param {object} ctx.result
   * @param {string} ctx.lineageHash
   * @returns {Promise<object>}  GovernanceAttestation (matches schema $defs)
   */
  async attest(ctx) {
    const checks = await Promise.all([
      this.#runGC04(ctx.result),
      this.#runGC05(ctx),
      ...this.#customChecks.map((fn) => fn(ctx)),
    ]);

    for (const c of checks) {
      if (c.result === 'fail' && this.#strictMode) {
        throw new GovernanceViolationError(c);
      }
    }

    const allChecks = await this.preCheck(ctx.query).then((pre) => [...pre, ...checks]).catch(() => checks);

    const status = allChecks.some((c) => c.result === 'fail')
      ? 'failed'
      : allChecks.some((c) => c.result === 'warn')
      ? 'warned'
      : 'passed';

    const attestationPayload = {
      amendmentRef: this.#amendmentRef,
      checksRun: checks,
      harvesterId: this.#harvesterId,
      lineageHash: ctx.lineageHash,
      specVersion: this.#specVersion,
      status,
    };

    const attestationId = deriveId(attestationPayload);

    return {
      attestationId,
      harvesterId: this.#harvesterId,
      specVersion: this.#specVersion,
      amendmentRef: this.#amendmentRef,
      status,
      checksRun: checks,
      attestedAt: new Date().toISOString(),
      notes: [],
    };
  }

  /** Check whether governance subsystem is healthy and registry is reachable. */
  async isReady() {
    try {
      const check = await this.#runGC01();
      return check.result !== 'fail';
    } catch {
      return false;
    }
  }

  // ── Built-in Checks ────────────────────────────────────────────────────────

  /** GC-01: Verify harvesterId exists in the live registry */
  async #runGC01() {
    const entry = HARVESTER_REGISTRY.get(this.#harvesterId);
    if (!entry) {
      return this.#result(CHECKS.GC_01, 'fail', `harvesterId '${this.#harvesterId}' not found in registry`);
    }
    if (entry.status !== 'active') {
      return this.#result(CHECKS.GC_01, 'fail', `harvester status is '${entry.status}', expected 'active'`);
    }
    if (!entry.amendmentRefs?.includes(AMENDMENT)) {
      return this.#result(CHECKS.GC_01, 'warn', `harvester not explicitly bound to amendment ${AMENDMENT}`);
    }
    return this.#result(CHECKS.GC_01, 'pass');
  }

  /** GC-02: Validate required query fields and type constraints */
  async #runGC02(query) {
    const errors = [];
    if (!query.queryId || typeof query.queryId !== 'string') errors.push('queryId missing or non-string');
    if (typeof query.prompt !== 'string' || query.prompt.trim() === '') errors.push('prompt empty or non-string');
    if (query.modelHints && !Array.isArray(query.modelHints)) errors.push('modelHints must be an array');
    if (query.meta !== undefined && (typeof query.meta !== 'object' || Array.isArray(query.meta))) {
      errors.push('meta must be an object');
    }

    if (errors.length > 0) {
      return this.#result(CHECKS.GC_02, 'fail', errors.join('; '));
    }
    return this.#result(CHECKS.GC_02, 'pass');
  }

  /** GC-03: Enforce prompt size and disallow policy-prohibited content markers */
  async #runGC03(query) {
    const bytes = Buffer.byteLength(query.prompt, 'utf8');
    if (bytes > MAX_PROMPT_BYTES) {
      return this.#result(
        CHECKS.GC_03,
        'fail',
        `prompt exceeds maximum size: ${bytes} bytes > ${MAX_PROMPT_BYTES} bytes`
      );
    }
    // CIC §2 prohibited pattern gate (operator may extend via customChecks)
    const prohibited = [
      /\bignore (?:all\s+)?(?:previous|prior|all)\s+instructions\b/i,
      /\bsystem prompt override\b/i,
    ];
    for (const re of prohibited) {
      if (re.test(query.prompt)) {
        return this.#result(CHECKS.GC_03, 'fail', `prompt matches prohibited pattern: ${re}`);
      }
    }
    return this.#result(CHECKS.GC_03, 'pass');
  }

  /** GC-04: Confirm the selected model is on the CIC allowlist */
  async #runGC04(result) {
    const model = result?.rawMeta?.model ?? result?.model;
    if (!model) {
      return this.#result(CHECKS.GC_04, 'warn', 'model field absent from response — cannot enforce allowlist');
    }
    const matched = [...MODEL_ALLOWLIST].some((allowed) =>
      model.toLowerCase().startsWith(allowed.toLowerCase())
    );
    if (!matched) {
      return this.#result(CHECKS.GC_04, 'fail', `model '${model}' is not on the CIC MODEL_ALLOWLIST`);
    }
    return this.#result(CHECKS.GC_04, 'pass');
  }

  /** GC-05: Ensure the attestation context has all required fields for record completeness */
  async #runGC05(ctx) {
    const missing = [];
    if (!ctx.lineageHash) missing.push('lineageHash');
    if (!ctx.query?.queryId) missing.push('query.queryId');
    if (!ctx.result?.model) missing.push('result.model');
    if (!ctx.result?.response && ctx.result?.response !== '') missing.push('result.response');
    if (missing.length > 0) {
      return this.#result(CHECKS.GC_05, 'fail', `attestation context missing: ${missing.join(', ')}`);
    }
    return this.#result(CHECKS.GC_05, 'pass');
  }

  #result(check, result, detail) {
    return { ...check, result, ...(detail ? { detail } : {}) };
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class GovernanceViolationError extends Error {
  constructor(check) {
    super(`Governance check FAILED [${check.checkId}] ${check.name}: ${check.detail ?? '(no detail)'}`);
    this.name = 'GovernanceViolationError';
    this.checkId = check.checkId;
    this.checkName = check.name;
    this.detail = check.detail;
  }
}

export default GovernanceWrapper;

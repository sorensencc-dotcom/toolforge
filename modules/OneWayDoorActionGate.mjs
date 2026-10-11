import crypto from 'node:crypto';

/**
 * Action Reversibility Taxonomy:
 * - REVERSIBLE: Operations that can be undone or have no persistent side effects (Two-Way Doors).
 * - IRREVERSIBLE: Mutations with persistent, external, destructive, or financial effects (One-Way Doors).
 * - BOUNDED: Mutations strictly confined to isolated scratchpads, sandbox jails, or dry-run buffers.
 */
export const REVERSIBILITY = Object.freeze({
  REVERSIBLE: 'REVERSIBLE',
  IRREVERSIBLE: 'IRREVERSIBLE',
  BOUNDED: 'BOUNDED'
});

/**
 * Standard Tool Reversibility Registry
 */
const TOOL_REVERSIBILITY_REGISTRY = new Map([
  // Safe / Two-Way Door operations
  ['read_file', REVERSIBILITY.REVERSIBLE],
  ['list_files', REVERSIBILITY.REVERSIBLE],
  ['search_code', REVERSIBILITY.REVERSIBLE],
  ['git_status', REVERSIBILITY.REVERSIBLE],
  ['git_diff', REVERSIBILITY.REVERSIBLE],
  ['git_log', REVERSIBILITY.REVERSIBLE],
  ['inspect_symbol', REVERSIBILITY.REVERSIBLE],

  // Bounded / Sandbox operations
  ['write_scratch', REVERSIBILITY.BOUNDED],
  ['run_sandboxed_test', REVERSIBILITY.BOUNDED],
  ['create_temp_file', REVERSIBILITY.BOUNDED],

  // Irreversible / One-Way Door operations
  ['delete_file', REVERSIBILITY.IRREVERSIBLE],
  ['git_push', REVERSIBILITY.IRREVERSIBLE],
  ['publish_package', REVERSIBILITY.IRREVERSIBLE],
  ['send_message', REVERSIBILITY.IRREVERSIBLE],
  ['modify_production_infra', REVERSIBILITY.IRREVERSIBLE],
  ['execute_financial_transaction', REVERSIBILITY.IRREVERSIBLE],
  ['deploy_service', REVERSIBILITY.IRREVERSIBLE],
  ['drop_table', REVERSIBILITY.IRREVERSIBLE]
]);

/**
 * Register or override a tool's reversibility classification
 */
export function registerToolReversibility(toolName, reversibilityTag) {
  if (!Object.values(REVERSIBILITY).includes(reversibilityTag)) {
    throw new Error(`Invalid reversibility tag '${reversibilityTag}'. Must be one of: ${Object.values(REVERSIBILITY).join(', ')}`);
  }
  TOOL_REVERSIBILITY_REGISTRY.set(toolName, reversibilityTag);
}

/**
 * Get registered reversibility classification for a tool
 */
export function getToolReversibility(toolName) {
  return TOOL_REVERSIBILITY_REGISTRY.get(toolName) || null;
}

/**
 * Infer reversibility if not explicitly registered, based on action name verbs
 */
export function classifyActionReversibility({ toolName = '', params = {} } = {}) {
  const registered = getToolReversibility(toolName);
  if (registered) return registered;

  const lower = toolName.toLowerCase();

  // One-way door verbs
  if (
    lower.includes('delete') ||
    lower.includes('drop') ||
    lower.includes('purge') ||
    lower.includes('destroy') ||
    lower.includes('truncate') ||
    lower.includes('nuke') ||
    lower.includes('push') ||
    lower.includes('publish') ||
    lower.includes('transact') ||
    lower.includes('kill')
  ) {
    return REVERSIBILITY.IRREVERSIBLE;
  }

  // Bounded verbs
  if (lower.includes('scratch') || lower.includes('temp') || lower.includes('sandbox')) {
    return REVERSIBILITY.BOUNDED;
  }

  // Two-way door verbs
  if (
    lower.includes('read') ||
    lower.includes('list') ||
    lower.includes('search') ||
    lower.includes('get') ||
    lower.includes('fetch') ||
    lower.includes('status') ||
    lower.includes('inspect')
  ) {
    return REVERSIBILITY.REVERSIBLE;
  }

  // Conservative default: if unknown, bounded if inside scratch, else irreversible
  return REVERSIBILITY.IRREVERSIBLE;
}

/**
 * Generate a cryptographically signed confirmation token for an action gate
 */
export function generateConfirmationToken(gateId, secretKey = 'default-toolforge-gate-secret') {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(`GATE_CONFIRMATION:${gateId}`);
  return `CONFIRMED:${gateId}:${hmac.digest('hex').slice(0, 32)}`;
}

/**
 * Verify validity of a confirmation token against a specific gateId
 */
export function verifyConfirmationToken(token, gateId, secretKey = 'default-toolforge-gate-secret') {
  if (!token || typeof token !== 'string') return false;
  const expected = generateConfirmationToken(gateId, secretKey);
  const bufA = Buffer.from(token, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Formats a user-facing visual gating prompt for CLI display
 */
export function formatGatingPrompt(gateInfo) {
  const {
    gateId,
    toolName,
    params,
    riskClassification = 'CRITICAL',
    reversibility = REVERSIBILITY.IRREVERSIBLE,
    diffSummary = 'No diff available'
  } = gateInfo;

  return [
    '=================================================================',
    ' ⚠️  ONE-WAY DOOR EXECUTION GATE (ACTION CONFIRMATION REQUIRED)',
    '=================================================================',
    ` Tool:           ${toolName}`,
    ` Risk Level:     ${riskClassification}`,
    ` Reversibility:  ${reversibility}`,
    ` Gate ID:        ${gateId}`,
    ` Target/Params:  ${JSON.stringify(params)}`,
    ` Impact/Diff:    ${diffSummary}`,
    '-----------------------------------------------------------------',
    ' This action is irreversible. Autonomous execution is paused.',
    ` To approve, provide token: ${gateId}`,
    '================================================================='
  ].join('\n');
}

export function canonicalizeValue(val) {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalizeValue);
  const sorted = {};
  for (const k of Object.keys(val).sort()) {
    sorted[k] = canonicalizeValue(val[k]);
  }
  return sorted;
}

/**
 * One-Way Door Action Gate Interceptor Middleware
 */
export class OneWayDoorInterceptor {
  constructor(options = {}) {
    this.secretKey = options.secretKey || 'default-toolforge-gate-secret';
    this.allowedBoundedPrefixes = options.allowedBoundedPrefixes || ['scratch/', 'tmp/', 'temp/', '.tmp/'];
  }


  /**
   * Compute deterministic gate ID for an action call
   */
  computeGateId(toolName, params) {
    const canonical = {
      toolName,
      params: canonicalizeValue(params)
    };
    const raw = JSON.stringify(canonical);
    return `gate-${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
  }


  /**
   * Intercept a tool call and evaluate reversibility, bounds, confirmation, and plan drift
   */
  async intercept({ toolName, params = {}, confirmationToken = null, planContext = null } = {}) {
    const reversibility = classifyActionReversibility({ toolName, params });
    const gateId = this.computeGateId(toolName, params);

    // 1. Dynamic Plan Drift Detection:
    // If agent is executing under a declared REVERSIBLE_ONLY plan, hard-pause if it tries an irreversible action
    if (planContext && planContext.declaredMode === 'REVERSIBLE_ONLY') {
      if (reversibility === REVERSIBILITY.IRREVERSIBLE) {
        return {
          status: 'HARD_PAUSE',
          error: 'PLAN_DRIFT_DETECTED',
          driftedAction: toolName,
          planId: planContext.planId,
          reason: `Reversible-only plan attempted fallback or drift into an irreversible operation without human approval (${toolName})`
        };
      }
    }

    // 2. Reversible Actions (Two-Way Doors)
    if (reversibility === REVERSIBILITY.REVERSIBLE) {
      return {
        status: 'ALLOWED',
        reversibility: REVERSIBILITY.REVERSIBLE,
        confirmationRequired: false
      };
    }

    // 3. Bounded Actions (Scoped Sandboxes)
    if (reversibility === REVERSIBILITY.BOUNDED) {
      const targetPath = params.path || params.filePath || params.file || '';
      if (targetPath) {
        const normalized = targetPath.replace(/\\/g, '/');
        const isBounded = this.allowedBoundedPrefixes.some(prefix =>
          normalized.startsWith(prefix) || normalized.includes(`/${prefix}`)
        );
        if (!isBounded) {
          return {
            status: 'BLOCKED_BY_GATE',
            reversibility: REVERSIBILITY.BOUNDED,
            breach: 'BOUNDARY_EXCEEDED',
            gateId,
            reason: `Action target breaches bounded scratchpad limits (${targetPath})`
          };
        }
      }
      return {
        status: 'ALLOWED',
        reversibility: REVERSIBILITY.BOUNDED,
        confirmationRequired: false
      };
    }

    // 4. Irreversible Actions (One-Way Doors)
    if (reversibility === REVERSIBILITY.IRREVERSIBLE) {
      if (confirmationToken) {
        const isValid = verifyConfirmationToken(confirmationToken, gateId, this.secretKey);
        if (isValid) {
          return {
            status: 'ALLOWED',
            reversibility: REVERSIBILITY.IRREVERSIBLE,
            confirmed: true,
            tokenVerified: true,
            gateId
          };
        }
        return {
          status: 'BLOCKED_BY_GATE',
          reversibility: REVERSIBILITY.IRREVERSIBLE,
          error: 'INVALID_CONFIRMATION_TOKEN',
          gateId
        };
      }

      // Block unconfirmed irreversible execution
      return {
        status: 'BLOCKED_BY_GATE',
        reversibility: REVERSIBILITY.IRREVERSIBLE,
        confirmationRequired: true,
        gateId,
        riskClassification: 'CRITICAL',
        diffSummary: `Irreversible mutation via ${toolName} on ${JSON.stringify(params)}`,
        reason: `Irreversible action blocked: confirmation token required for ${toolName}`
      };
    }

    // Fallback block
    return {
      status: 'BLOCKED_BY_GATE',
      reversibility: REVERSIBILITY.IRREVERSIBLE,
      confirmationRequired: true,
      gateId,
      reason: 'Action blocked by default execution gate'
    };
  }
}

import { EventEmitter } from 'node:events';
import { ToolBundleContract } from './contracts.mjs';

export const L0_BUNDLE_ID = 'bundle:toolforge_l0';
export const SOFT_BUDGET_TOKENS = 1_800; // warn only
export const HARD_BUDGET_TOKENS = 2_600; // L0 250 + L1 800 + L2 1,500, plus margin: reject above
export const CHURN_MAX_OPS = 6;
export const CHURN_WINDOW_TURNS = 3;

export const heuristicTokenCounter = {
  count: (tool) =>
    Math.ceil(
      JSON.stringify({ name: tool.name, description: tool.description, input_schema: tool.input_schema }).length / 3.8,
    ),
};

export const denyAllStepUp = { verify: async () => false };

const fail = (error) => ({ ok: false, error });
const roleAllowed = (b, role) => b.allowed_roles.includes('*') || b.allowed_roles.includes(role);

export class DynamicToolScopingHook extends EventEmitter {
  deps;
  bundles = new Map();
  bundleTokens = new Map();
  toolOwner = new Map();
  spans = new Map();
  reclaimedTotal = 0;

  constructor(deps) {
    super();
    this.deps = deps;
    this.registerBundle({
      bundle_id: L0_BUNDLE_ID,
      domain: 'core',
      description: 'Discovery and dynamic tool mounting primitives',
      allowed_roles: ['*'],
      requires_step_up: false,
      max_mounted_ttl_ms: null,
      tools: [
        l0Tool('toolforge_discover_bundles', 'Search permitted tool bundles by intent keywords', 'query'),
        l0Tool('toolforge_mount_bundle', 'Mount a permitted tool bundle into this span', 'bundle_id'),
        l0Tool('toolforge_dismount_bundle', 'Evict a mounted tool bundle from this span', 'bundle_id'),
      ],
    });
  }

  /** Throws on an invalid bundle, a duplicate bundle id, or a tool name owned by another bundle. */
  registerBundle(raw) {
    const bundle = ToolBundleContract.parse(raw);
    if (this.bundles.has(bundle.bundle_id)) throw new Error(`DUPLICATE_BUNDLE ${bundle.bundle_id}`);
    for (const t of bundle.tools) {
      const owner = this.toolOwner.get(t.name);
      if (owner) throw new Error(`DUPLICATE_TOOL ${t.name} in ${owner} and ${bundle.bundle_id}`);
    }
    this.bundles.set(bundle.bundle_id, bundle);
    this.bundleTokens.set(
      bundle.bundle_id,
      bundle.tools.reduce((n, t) => n + this.deps.tokens.count(t), 0),
    );
    for (const t of bundle.tools) this.toolOwner.set(t.name, bundle.bundle_id);
    return bundle;
  }

  async startSpan(a

   ) {
    if (this.spans.has(a.span_id)) return fail('INVALID_SPAN');
    const parent = a.parent_span_id ? this.spans.get(a.parent_span_id) : undefined;
    if (a.parent_span_id && !parent) return fail('INVALID_SPAN');
    if (parent?.halted) return fail('SPAN_HALTED');

    const ceiling = new Set(
      [...this.bundles.values()]
        .filter((b) => roleAllowed(b, a.actor_role))
        .map((b) => b.bundle_id)
        .filter((id) => !parent || parent.ceiling.has(id)),
    );
    // Attenuation: a child never holds a grant its parent lacks. Step-up approvals are not inherited.
    const grants = new Set(parent ? a.grants.filter((g) => parent.grants.has(g)) : a.grants);
    const sc = {
      session_id: a.session_id,
      trace_id: a.trace_id,
      span_id: a.span_id,
      parent_span_id: a.parent_span_id,
      actor_role: a.actor_role,
      grants,
      ceiling,
      mounted: new Map(),
      turn: 0,
      churn_turns: [],
      halted: false,
      children: new Set(),
      reclaimed_tokens: 0,
    };
    this.spans.set(sc.span_id, sc);
    parent?.children.add(sc.span_id);
    this.mountUnchecked(sc, L0_BUNDLE_ID);

    const roleBundleId = this.deps.roleBundles[a.actor_role];
    const roleBundle = roleBundleId ? this.bundles.get(roleBundleId) : undefined;
    if (roleBundle && ceiling.has(roleBundle.bundle_id) && !roleBundle.requires_step_up) {
      if (!(await this.audit(sc, 'MOUNT', roleBundle.bundle_id))) {
        await this.endSpan(sc.span_id);
        return fail('WAL_APPEND_FAILED');
      }
      this.mountUnchecked(sc, roleBundle.bundle_id);
    }
    return { ok: true };
  }

  /** Host calls this once per model turn. Drives the churn window and TTL expiry. */
  beginTurn(spanId) {
    const sc = this.spans.get(spanId);
    if (!sc) return;
    sc.turn += 1;
    this.expire(sc);
  }

  discover(
    spanId,
    query,
  ) {
    const sc = this.live(spanId);
    if (!sc) return fail('INVALID_SPAN');
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const bundles = [...sc.ceiling]
      .filter((id) => !sc.mounted.has(id))
      .map((id) => this.bundles.get(id))
      .filter((b) => {
        const hay = `${b.bundle_id} ${b.domain} ${b.description}`.toLowerCase();
        return words.length === 0 || words.some((w) => hay.includes(w));
      })
      .map((b) => ({
        bundle_id: b.bundle_id,
        description: b.description,
        requires_step_up: b.requires_step_up,
        schema_tokens: this.bundleTokens.get(b.bundle_id),
      }));
    return { ok: true, bundles };
  }

  async mount(spanId, bundleId, stepUpEvidence) {
    const sc = this.live(spanId);
    if (!sc) return fail('INVALID_SPAN');
    if (sc.halted) return fail('SPAN_HALTED');
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return fail('BUNDLE_NOT_FOUND');
    if (!sc.ceiling.has(bundleId)) return fail('BUNDLE_NOT_PERMITTED');
    if (sc.mounted.has(bundleId)) return { ok: true, mounted_tools: [] };
    if (this.recordChurn(sc)) return fail('CIRCUIT_BREAKER_TOOL_CHURN');
    if (this.spend(sc) + this.bundleTokens.get(bundleId) > HARD_BUDGET_TOKENS) return fail('SCHEMA_BUDGET_EXCEEDED');

    if (bundle.requires_step_up) {
      const ok = await this.deps.stepUp.verify(
        { session_id: sc.session_id, span_id: sc.span_id, bundle_id: bundleId },
        stepUpEvidence,
      );
      // State may have changed while awaiting the verifier.
      if (!ok || this.spans.get(spanId) !== sc || sc.halted) return fail('STEP_UP_REQUIRED');
      if (sc.mounted.has(bundleId)) return { ok: true, mounted_tools: [] };
      if (this.spend(sc) + this.bundleTokens.get(bundleId) > HARD_BUDGET_TOKENS) return fail('SCHEMA_BUDGET_EXCEEDED');
    }
    if (!(await this.audit(sc, 'MOUNT', bundleId))) return fail('WAL_APPEND_FAILED');
    if (this.spans.get(spanId) !== sc) return fail('INVALID_SPAN');

    this.mountUnchecked(sc, bundleId);
    if (this.spend(sc) > SOFT_BUDGET_TOKENS) {
      this.emit('SCHEMA_SATURATION_WARNING', { span_id: sc.span_id, schema_tokens: this.spend(sc) });
    }
    return { ok: true, mounted_tools: bundle.tools.map((t) => t.name) };
  }

  async dismount(spanId, bundleId) {
    const sc = this.live(spanId);
    if (!sc) return fail('INVALID_SPAN');
    if (sc.halted) return fail('SPAN_HALTED');
    if (bundleId === L0_BUNDLE_ID) return fail('BUNDLE_NOT_PERMITTED');
    if (!sc.mounted.has(bundleId)) return fail('BUNDLE_NOT_FOUND');
    if (this.recordChurn(sc)) return fail('CIRCUIT_BREAKER_TOOL_CHURN');
    if (!(await this.audit(sc, 'DISMOUNT', bundleId))) return fail('WAL_APPEND_FAILED');
    return { ok: true, reclaimed_tokens: this.dismountUnchecked(sc, bundleId) };
  }

  /** The only path by which a tool may run. Tools outside the span's mounted bundles are rejected. */
  async invoke (
    spanId,
    toolName,
    args,
    exec,
  ) {
    const sc = this.live(spanId);
    if (!sc) return fail('INVALID_SPAN');
    if (sc.halted) return fail('SPAN_HALTED');
    const hit = this.findMounted(sc, toolName);
    if (!hit) return fail('TOOL_NOT_MOUNTED');
    const { tool } = hit;
    if (tool.required_capability && !sc.grants.has(tool.required_capability)) return fail('CAPABILITY_MISSING');

    const mutating = tool.side_effect === 'MUTATING';
    const action_hash = mutating ? this.deps.hashAction(toolName, args) : undefined;
    const base = { session_id: sc.session_id, trace_id: sc.trace_id, span_id: sc.span_id, tool: toolName, action_hash };
    if (mutating) {
      try {
        await this.deps.wal.append({ ...base, phase: 'INTENT' }); // write-ahead: intent is durable before the effect
      } catch {
        return fail('WAL_APPEND_FAILED');
      }
    }
    let value;
    try {
      value = await exec(args);
    } catch (err) {
      if (mutating) await this.deps.wal.append({ ...base, phase: 'OUTCOME', ok: false }).catch(() => undefined);
      throw err;
    }
    if (mutating) await this.deps.wal.append({ ...base, phase: 'OUTCOME', ok: true }).catch(() => this.emit('walOutcomeLost', base));
    sc.churn_turns = []; // a functional call resets the churn window
    return { ok: true, value };
  }

  getActiveTools(spanId) {
    const sc = this.live(spanId);
    if (!sc) return [];
    return [...sc.mounted.keys()].flatMap((id) => this.bundles.get(id) .tools);
  }

  snapshot(spanId) {
    const sc = this.live(spanId);
    if (!sc) return undefined;
    return {
      active_bundles: [...sc.mounted.keys()],
      mounted_tools_count: this.getActiveTools(spanId).length,
      schema_tokens: this.spend(sc),
      reclaimed_tokens_span: sc.reclaimed_tokens,
      reclaimed_tokens_total: this.reclaimedTotal,
      halted: sc.halted,
    };
  }

  /** Ends the span and its descendants, evicting every mounted bundle. */
  async endSpan(spanId) {
    const sc = this.spans.get(spanId);
    if (!sc) return;
    for (const child of [...sc.children]) await this.endSpan(child);
    for (const id of [...sc.mounted.keys()]) this.dismountUnchecked(sc, id);
    this.spans.delete(spanId);
    if (sc.parent_span_id) this.spans.get(sc.parent_span_id)?.children.delete(spanId);
  }

          live(spanId) {
    const sc = this.spans.get(spanId);
    if (sc) this.expire(sc);
    return sc;
  }

          spend(sc) {
    let n = 0;
    for (const id of sc.mounted.keys()) n += this.bundleTokens.get(id);
    return n;
  }

          findMounted(sc, toolName) {
    const owner = this.toolOwner.get(toolName);
    if (!owner || !sc.mounted.has(owner)) return undefined;
    const bundle = this.bundles.get(owner);
    return { tool: bundle.tools.find((t) => t.name === toolName), bundle };
  }

          mountUnchecked(sc, bundleId) {
    sc.mounted.set(bundleId, { at: this.deps.clock.now() });
    this.emit('toolsChanged', { span_id: sc.span_id, trace_id: sc.trace_id, action: 'MOUNT', bundle_id: bundleId });
  }

          dismountUnchecked(sc, bundleId) {
    const reclaimed = this.bundleTokens.get(bundleId);
    sc.mounted.delete(bundleId);
    sc.reclaimed_tokens += reclaimed;
    this.reclaimedTotal += reclaimed;
    this.emit('toolsChanged', { span_id: sc.span_id, trace_id: sc.trace_id, action: 'DISMOUNT', bundle_id: bundleId });
    return reclaimed;
  }

  /** TTL expiry only removes authority, so a failed audit append does not block it. */
          expire(sc) {
    const now = this.deps.clock.now();
    for (const [id, m] of sc.mounted) {
      const ttl = this.bundles.get(id) .max_mounted_ttl_ms;
      if (ttl !== null && now - m.at > ttl) {
        this.dismountUnchecked(sc, id);
        void this.audit(sc, 'EXPIRE', id);
      }
    }
  }

  /** Counts a mount or dismount. Returns true and halts the span when the churn limit trips. */
          recordChurn(sc) {
    sc.churn_turns.push(sc.turn);
    sc.churn_turns = sc.churn_turns.filter((t) => t > sc.turn - CHURN_WINDOW_TURNS);
    if (sc.churn_turns.length > CHURN_MAX_OPS) {
      sc.halted = true;
      this.emit('CIRCUIT_BREAKER_TOOL_CHURN', { span_id: sc.span_id });
      return true;
    }
    return false;
  }

          async audit(sc, action, bundle_id) {
    try {
      await this.deps.wal.append({
        phase: 'SCOPE_CHANGE',
        session_id: sc.session_id,
        trace_id: sc.trace_id,
        span_id: sc.span_id,
        bundle_id,
        action,
      });
      return true;
    } catch {
      return false;
    }
  }
}

function l0Tool(name, description, param) {
  return {
    name,
    description,
    side_effect: 'READ_ONLY',
    risk_tier: 'LOW',
    input_schema: { type: 'object', properties: { [param]: { type: 'string' } }, required: [param] },
  };
}

export const ENFORCEMENT_MODE = 'linux-polling';
export const STATES = Object.freeze(['created', 'running', 'terminating', 'violating', 'closed']);
export const TRANSITIONS = Object.freeze({
  created: new Set(['running', 'closed']),
  running: new Set(['terminating', 'violating', 'closed']),
  violating: new Set(['terminating', 'closed']),
  terminating: new Set(['closed']),
  closed: new Set(),
});

export function validateEnvelope(owner, envelope) {
  if (typeof owner !== 'string' || !owner) throw new TypeError('owner is required');
  if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope is required');
  const positive = ['cpu_limit_percent', 'memory_limit_mb', 'max_concurrency', 'timeout_seconds'];
  for (const key of positive) if (!Number.isFinite(envelope[key]) || envelope[key] <= 0) throw new TypeError(`${key} must be positive`);
  if (envelope.restart_policy !== 'none') throw new TypeError('only restart_policy none is supported');
  for (const key of ['workflow_id']) if (typeof envelope[key] !== 'string' || !envelope[key]) throw new TypeError(`${key} is required`);
  return Object.freeze({ ...envelope, owner, restart_policy: 'none' });
}

export function transition(state, next) {
  if (!TRANSITIONS[state]?.has(next)) throw new Error(`illegal state transition ${state} -> ${next}`);
  return next;
}

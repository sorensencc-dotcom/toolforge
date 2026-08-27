import { evaluateAutomationTestPolicy } from './policy.js';

export function evaluateCiAutomationPolicy(entries, adapter, options = {}) {
  const policy = evaluateAutomationTestPolicy(entries, adapter, options);
  const advisory = options.advisory === true;

  return {
    enforcement: advisory ? 'advisory' : 'blocking',
    exitCode: policy.decision === 'block' && !advisory ? 1 : 0,
    policy,
  };
}

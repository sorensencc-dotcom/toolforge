import { classifyDiff } from './classifier.js';

const REGRESSION_TEST_PATH = /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/;

function isRegressionTestPath(path) {
  return REGRESSION_TEST_PATH.test(path);
}

export function evaluateAutomationTestPolicy(entries, adapter, options = {}) {
  if (adapter === null || typeof adapter !== 'object' || !Array.isArray(adapter.automationPaths)) {
    throw new TypeError('Invalid delivery-guard automation policy input');
  }

  const classification = classifyDiff(
    entries,
    { generatedPaths: adapter.automationPaths },
    { generatedIntent: true },
  );
  const automationPaths = classification.generatedPaths;
  const regressionTestPaths = classification.paths.filter(isRegressionTestPath);

  if (automationPaths.length === 0 || regressionTestPaths.length > 0) {
    return {
      decision: 'allow',
      issues: [],
      automationPaths,
      regressionTestPaths,
      exemption: null,
    };
  }

  if (typeof options.exemptionReason === 'string' && options.exemptionReason.trim().length > 0) {
    return {
      decision: 'allow',
      issues: [],
      automationPaths,
      regressionTestPaths,
      exemption: { reason: options.exemptionReason.trim() },
    };
  }

  return {
    decision: 'block',
    issues: Object.hasOwn(options, 'exemptionReason')
      ? ['automation-regression-test-required', 'automation-exemption-reason-required']
      : ['automation-regression-test-required'],
    automationPaths,
    regressionTestPaths,
    exemption: null,
  };
}

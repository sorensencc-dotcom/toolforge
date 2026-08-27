import { classifyDiff } from './classifier.js';

const REGRESSION_TEST_PATH = /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const TEST_DESTINATION_STATUSES = new Set([
  'added',
  'copied',
  'modified',
  'renamed',
  'untracked',
]);

function isRegressionTestPath(path) {
  return REGRESSION_TEST_PATH.test(path);
}

function regressionTestDestinations(entries) {
  const paths = new Set();
  for (const entry of entries) {
    const normalized = typeof entry === 'string'
      ? { path: entry, status: 'untracked' }
      : { path: entry.path, status: entry.status ?? 'modified' };
    const destination = normalized.path.replaceAll('\\', '/').replace(/^\.\//, '');
    if (TEST_DESTINATION_STATUSES.has(normalized.status) && isRegressionTestPath(destination)) {
      paths.add(destination);
    }
  }
  return [...paths].sort();
}

function evaluateExemption(exemption, trustedAuthorities) {
  if (exemption === undefined) return { exemption: null, issues: [] };
  if (exemption === null || typeof exemption !== 'object' || Array.isArray(exemption)) {
    return { exemption: null, issues: ['automation-exemption-record-invalid'] };
  }

  const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
  if (!isNonEmpty(exemption.reason)) {
    return { exemption: null, issues: ['automation-exemption-reason-required'] };
  }
  if (!isNonEmpty(exemption.authority) || !trustedAuthorities.includes(exemption.authority)) {
    return { exemption: null, issues: ['automation-exemption-authority-not-trusted'] };
  }
  if (exemption.version !== 1
    || !isNonEmpty(exemption.commitSha)
    || !isNonEmpty(exemption.approver)
    || !isNonEmpty(exemption.approvalRef)) {
    return { exemption: null, issues: ['automation-exemption-record-invalid'] };
  }

  return {
    exemption: {
      version: 1,
      commitSha: exemption.commitSha.trim(),
      authority: exemption.authority.trim(),
      approver: exemption.approver.trim(),
      reason: exemption.reason.trim(),
      approvalRef: exemption.approvalRef.trim(),
    },
    issues: [],
  };
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
  const regressionTestPaths = regressionTestDestinations(entries);

  if (automationPaths.length === 0 || regressionTestPaths.length > 0) {
    return {
      decision: 'allow',
      issues: [],
      automationPaths,
      regressionTestPaths,
      exemption: null,
    };
  }

  const exemptionResult = evaluateExemption(
    options.exemption,
    Array.isArray(adapter.trustedExemptionAuthorities)
      ? adapter.trustedExemptionAuthorities
      : [],
  );
  if (exemptionResult.exemption !== null) {
    return {
      decision: 'allow',
      issues: [],
      automationPaths,
      regressionTestPaths,
      exemption: exemptionResult.exemption,
    };
  }

  return {
    decision: 'block',
    issues: ['automation-regression-test-required', ...exemptionResult.issues],
    automationPaths,
    regressionTestPaths,
    exemption: null,
  };
}

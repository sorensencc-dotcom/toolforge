import { spawnSync } from 'node:child_process';

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

function combinePolicies(commitResults) {
  const policies = commitResults.map(({ policy }) => policy);
  const unique = (values) => [...new Set(values)].sort();
  const exemptions = policies.map(({ exemption }) => exemption).filter(Boolean);

  return {
    decision: policies.some(({ decision }) => decision === 'block') ? 'block' : 'allow',
    issues: unique(policies.flatMap(({ issues }) => issues)),
    automationPaths: unique(policies.flatMap(({ automationPaths }) => automationPaths)),
    regressionTestPaths: unique(policies.flatMap(({ regressionTestPaths }) => regressionTestPaths)),
    exemption: exemptions.length === 1 ? exemptions[0] : null,
  };
}

export function evaluateCiCommitPolicies(changeSets, adapter, options = {}) {
  if (!Array.isArray(changeSets)) {
    throw new TypeError('Invalid delivery-guard commit policy input');
  }

  const advisory = options.advisory === true;
  const exemptions = Array.isArray(options.exemptions) ? options.exemptions : [];
  const commitResults = changeSets.map(({ commitSha, entries }) => {
    const exemption = exemptions.find((candidate) => candidate?.commitSha === commitSha);
    const result = evaluateCiAutomationPolicy(entries, adapter, { advisory, exemption });
    return { commitSha, ...result };
  });

  return {
    enforcement: advisory ? 'advisory' : 'blocking',
    exitCode: commitResults.some(({ exitCode }) => exitCode !== 0) ? 1 : 0,
    policy: combinePolicies(commitResults),
    commitResults,
  };
}

export function runConfiguredTestCommands(adapter, options = {}) {
  if (adapter === null || typeof adapter !== 'object' || !Array.isArray(adapter.testCommands)) {
    throw new TypeError('Invalid delivery-guard configured test input');
  }

  const run = options.run ?? spawnSync;
  const commands = adapter.testCommands.map((command) => {
    const execution = run(command, {
      cwd: options.cwd,
      shell: true,
      encoding: 'utf8',
    });
    const passed = execution.status === 0 && execution.signal === null;
    return {
      command,
      status: passed ? 'passed' : 'failed',
      exitCode: execution.status,
      signal: execution.signal,
    };
  });

  return {
    exitCode: commands.every(({ status }) => status === 'passed') ? 0 : 1,
    commands,
  };
}

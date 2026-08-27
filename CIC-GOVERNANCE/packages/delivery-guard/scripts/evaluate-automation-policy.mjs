#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import config from '../../../delivery-guard.config.js';
import {
  evaluateCiCommitPolicies,
  runConfiguredTestCommands,
  validateAdapterConfig,
} from '../src/index.js';

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..', '..');

function runGit(args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
}

function parseNameStatus(output) {
  const fields = output.split('\0');
  const entries = [];

  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    const statusCode = status[0];
    const statusMap = {
      A: 'added',
      C: 'copied',
      D: 'deleted',
      M: 'modified',
      R: 'renamed',
    };
    const firstPath = fields[index++];
    const entry = { path: firstPath, status: statusMap[statusCode] };
    if (statusCode === 'C' || statusCode === 'R') {
      entry.oldPath = firstPath;
      entry.path = fields[index++];
    }
    entries.push(entry);
  }
  return entries;
}

function diffEntries(base, head) {
  return parseNameStatus(runGit([
    'diff',
    '--name-status',
    '--find-renames',
    '-z',
    base,
    head,
  ]));
}

function consumeFlag(inputArgs, flag) {
  const index = inputArgs.indexOf(flag);
  if (index === -1) return false;
  inputArgs.splice(index, 1);
  return true;
}

function consumeValue(inputArgs, flag) {
  const index = inputArgs.indexOf(flag);
  if (index === -1) return undefined;
  const value = inputArgs[index + 1];
  if (value === undefined) throw new Error(`Missing value for ${flag}`);
  inputArgs.splice(index, 2);
  return value;
}

function parseArgs(args) {
  const inputArgs = [...args];
  const advisory = consumeFlag(inputArgs, '--advisory');
  const runTests = consumeFlag(inputArgs, '--run-tests');
  const trustedExemptionsFile = consumeValue(inputArgs, '--trusted-exemptions-file');

  if (inputArgs.length === 2 && inputArgs[0] === '--paths-file') {
    return {
      mode: 'paths-file',
      pathsFile: inputArgs[1],
      advisory,
      runTests,
      trustedExemptionsFile,
    };
  }
  if (inputArgs.length === 1 && inputArgs[0] === '--staged') {
    return { mode: 'staged', advisory, runTests, trustedExemptionsFile };
  }
  if (inputArgs.length === 4 && inputArgs[0] === '--base' && inputArgs[2] === '--head') {
    return {
      mode: 'git-diff',
      base: inputArgs[1],
      head: inputArgs[3],
      advisory,
      runTests,
      trustedExemptionsFile,
    };
  }
  throw new Error('Usage: evaluate-automation-policy.mjs --paths-file <path> | --staged | --base <ref> --head <ref> [--advisory] [--run-tests] [--trusted-exemptions-file <outside-checkout-path>]');
}

function commitChangeSets(base, head) {
  const resolvedHead = runGit(['rev-parse', '--verify', head]).trim();
  if (/^0+$/.test(base)) {
    return {
      source: 'root-diff',
      changeSets: [{ commitSha: resolvedHead, entries: diffEntries(EMPTY_TREE_SHA, resolvedHead) }],
    };
  }

  const commits = runGit(['rev-list', '--reverse', `${base}..${resolvedHead}`])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (commits.length === 0) {
    return {
      source: 'git-diff',
      changeSets: [{ commitSha: resolvedHead, entries: diffEntries(base, resolvedHead) }],
    };
  }

  return {
    source: 'git-diff',
    changeSets: commits.map((commitSha) => {
      const parents = runGit(['rev-list', '--parents', '-n', '1', commitSha])
        .trim()
        .split(/\s+/)
        .slice(1);
      return {
        commitSha,
        entries: diffEntries(parents[0] ?? EMPTY_TREE_SHA, commitSha),
      };
    }),
  };
}

function resolveChangeSets(parsed) {
  if (parsed.mode === 'paths-file') {
    return {
      source: 'paths-file',
      changeSets: [{
        commitSha: 'paths-file',
        entries: JSON.parse(fs.readFileSync(parsed.pathsFile, 'utf8')),
      }],
    };
  }
  if (parsed.mode === 'staged') {
    return {
      source: 'staged-diff',
      changeSets: [{
        commitSha: 'staged',
        entries: parseNameStatus(runGit([
          'diff',
          '--cached',
          '--name-status',
          '--find-renames',
          '-z',
        ])),
      }],
    };
  }
  return commitChangeSets(parsed.base, parsed.head);
}

function loadTrustedExemptions(file) {
  if (file === undefined) return [];
  const resolved = path.resolve(file);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('Trusted exemption file must be outside the repository checkout');
  }

  const record = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (record?.version !== 1 || !Array.isArray(record.exemptions)) {
    throw new Error('Trusted exemption file must contain version 1 and an exemptions array');
  }
  const key = process.env.DELIVERY_GUARD_EXEMPTION_HMAC_KEY;
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Trusted exemption verification key is unavailable');
  }

  return record.exemptions.map((exemption) => ({
    ...verifyExemptionSignature(record.version, exemption, key),
  }));
}

function verifyExemptionSignature(version, exemption, key) {
  const payload = [
    version,
    exemption?.commitSha,
    exemption?.authority,
    exemption?.approver,
    exemption?.reason,
    exemption?.approvalRef,
  ].join('\n');
  const expected = createHmac('sha256', key).update(payload).digest();
  const signature = typeof exemption?.signature === 'string'
    && /^[a-f0-9]{64}$/i.test(exemption.signature)
    ? Buffer.from(exemption.signature, 'hex')
    : Buffer.alloc(0);
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new Error('Trusted exemption signature verification failed');
  }

  const auditableFields = { ...exemption };
  delete auditableFields.signature;
  return { version, ...auditableFields };
}

const parsed = parseArgs(process.argv.slice(2));
const adapter = validateAdapterConfig(config);
const { source, changeSets } = resolveChangeSets(parsed);
const exemptions = loadTrustedExemptions(parsed.trustedExemptionsFile);
const result = evaluateCiCommitPolicies(changeSets, adapter, {
  advisory: parsed.advisory,
  exemptions,
});

const hasPairedAutomationChange = result.commitResults.some(({ policy }) => (
  policy.automationPaths.length > 0 && policy.regressionTestPaths.length > 0
));
let testExecution = {
  status: 'skipped',
  reason: parsed.runTests ? 'no-eligible-paired-automation-change' : 'not-requested',
  commands: [],
};
if (parsed.runTests && result.exitCode === 0 && hasPairedAutomationChange) {
  const testResult = runConfiguredTestCommands(adapter, { cwd: repositoryRoot });
  testExecution = {
    status: testResult.exitCode === 0 ? 'passed' : 'failed',
    commands: testResult.commands,
  };
  if (testResult.exitCode !== 0 && !parsed.advisory) result.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({
  check: 'automation-test-policy',
  source,
  ...result,
  testExecution,
})}\n`);
process.exitCode = result.exitCode;

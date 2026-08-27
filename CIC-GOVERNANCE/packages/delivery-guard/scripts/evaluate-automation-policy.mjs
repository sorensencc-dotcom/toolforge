#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import config from '../../../delivery-guard.config.js';
import { evaluateCiAutomationPolicy, validateAdapterConfig } from '../src/index.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..', '..');

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
    const path = fields[index++];
    const entry = { path, status: statusMap[statusCode] };
    if (statusCode === 'C' || statusCode === 'R') {
      entry.oldPath = path;
      entry.path = fields[index++];
    }
    entries.push(entry);
  }
  return entries;
}

function parseArgs(args) {
  const inputArgs = [...args];
  const advisoryIndex = inputArgs.indexOf('--advisory');
  const advisory = advisoryIndex !== -1;
  if (advisory) inputArgs.splice(advisoryIndex, 1);

  const exemptionIndex = inputArgs.indexOf('--exemption-reason');
  let exemptionReason;
  if (exemptionIndex !== -1) {
    exemptionReason = inputArgs[exemptionIndex + 1];
    if (exemptionReason === undefined) {
      throw new Error('Missing value for --exemption-reason');
    }
    inputArgs.splice(exemptionIndex, 2);
  }

  if (inputArgs.length === 2 && inputArgs[0] === '--paths-file') {
    return {
      source: 'paths-file',
      entries: JSON.parse(fs.readFileSync(inputArgs[1], 'utf8')),
      advisory,
      exemptionReason,
    };
  }
  if (inputArgs.length === 1 && inputArgs[0] === '--staged') {
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-status', '-z'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    return { source: 'staged-diff', entries: parseNameStatus(output), advisory, exemptionReason };
  }
  if (inputArgs.length === 4 && inputArgs[0] === '--base' && inputArgs[2] === '--head') {
    const output = execFileSync(
      'git',
      ['diff', '--name-status', '-z', inputArgs[1], inputArgs[3]],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    return { source: 'git-diff', entries: parseNameStatus(output), advisory, exemptionReason };
  }
  throw new Error('Usage: evaluate-automation-policy.mjs --paths-file <path> | --staged | --base <ref> --head <ref> [--advisory] [--exemption-reason <reason>]');
}

const {
  source,
  entries,
  advisory,
  exemptionReason,
} = parseArgs(process.argv.slice(2));
const adapter = validateAdapterConfig(config);
const options = { advisory };
if (exemptionReason !== undefined) options.exemptionReason = exemptionReason;
const result = evaluateCiAutomationPolicy(entries, adapter, options);

process.stdout.write(`${JSON.stringify({ check: 'automation-test-policy', source, ...result })}\n`);
process.exitCode = result.exitCode;

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { parsePushManifest } from './manifest.js';

const SENSITIVE_KEY_PATTERN = /^(?:password|secret|token|apiKey|api_key|authorization|bearer|prompt|prompts|messages?)$/i;
const SENSITIVE_STRING_PATTERNS = [
  /https?:\/\/[^/:]+:[^/@]+@/gi, // URLs with user:password
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi, // Bearer auth tokens
  /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/gi, // GitHub PATs / tokens
  /github_pat_[a-zA-Z0-9_]{30,}/gi, // GitHub fine-grained tokens
  /sk-[a-zA-Z0-9_\-]{20,}/gi, // OpenAI / API secret keys
  /xkeysib-[a-zA-Z0-9_\-]{30,}/gi,
];

export function sanitizeReceiptData(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_STRING_PATTERNS) {
      sanitized = sanitized.replaceAll(pattern, (match) => {
        if (match.startsWith('http://') || match.startsWith('https://')) {
          return match.replace(/:\/\/[^/:]+:[^/@]+@/, '://***:***@');
        }
        return '[REDACTED]';
      });
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeReceiptData(item));
  }

  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue; // Exclude prompts, secrets, and auth credentials completely
      }
      result[key] = sanitizeReceiptData(value);
    }
    return result;
  }

  return data;
}

export function getDefaultReceiptStoragePath() {
  if (process.env.DELIVERY_GUARD_RECEIPTS_PATH) {
    return path.resolve(process.env.DELIVERY_GUARD_RECEIPTS_PATH);
  }
  return path.join(os.homedir(), '.delivery-guard', 'receipts.jsonl');
}

export function writePushReceipt(receipt, options = {}) {
  const storagePath = options.storagePath
    ? path.resolve(options.storagePath)
    : getDefaultReceiptStoragePath();

  const sanitized = sanitizeReceiptData({
    receiptId: receipt.receiptId || crypto.randomUUID(),
    timestamp: receipt.timestamp || new Date().toISOString(),
    ...receipt,
  });

  const dir = path.dirname(storagePath);
  fs.mkdirSync(dir, { recursive: true });

  const line = `${JSON.stringify(sanitized)}\n`;
  fs.appendFileSync(storagePath, line, 'utf8');

  return {
    receipt: sanitized,
    receiptPath: storagePath,
  };
}

function defaultGitRunner(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    signal: result.signal,
  };
}

export function executePushWithReceipt(pushSpec = {}, options = {}) {
  const runGit = options.runGit || defaultGitRunner;
  const manifest = parsePushManifest(pushSpec.manifest, {
    defaultRepoRoot: options.defaultRepoRoot || process.cwd(),
    defaultRepoId: options.defaultRepoId,
    defaultPushArgs: pushSpec.pushArgs || [],
  });

  const repositories = [];

  for (const repo of manifest.repositories) {
    // 1. Resolve branch
    let branch = 'unknown';
    try {
      const branchRes = runGit('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repo.path);
      if (branchRes.status === 0 && branchRes.stdout.trim().length > 0) {
        branch = branchRes.stdout.trim();
      }
    } catch {
      // Best effort branch lookup
    }

    // 2. Perform git push
    const pushArgs = (repo.pushArgs && repo.pushArgs.length > 0)
      ? repo.pushArgs
      : (pushSpec.pushArgs || []);
    const gitArgs = ['push', ...pushArgs];

    let pushSuccess = false;
    let pushOutput = '';
    let pushError = '';
    let exitCode = 1;

    try {
      const pushRes = runGit('git', gitArgs, repo.path);
      exitCode = pushRes.status === null ? 1 : pushRes.status;
      pushSuccess = exitCode === 0;
      pushOutput = pushRes.stdout;
      pushError = pushRes.stderr;
    } catch (err) {
      pushError = err.message;
      exitCode = 1;
    }

    // 3. Capture post-push git status --short --branch
    let gitStatus = '';
    let statusSuccess = false;
    try {
      const statusRes = runGit('git', ['status', '--short', '--branch'], repo.path);
      if (statusRes.status === 0) {
        gitStatus = statusRes.stdout.trim();
        statusSuccess = true;
      } else {
        gitStatus = `[FAILED TO CAPTURE STATUS: exit ${statusRes.status}] ${statusRes.stderr}`.trim();
      }
    } catch (err) {
      gitStatus = `[FAILED TO CAPTURE STATUS: ${err.message}]`;
    }

    repositories.push({
      id: repo.id,
      path: repo.path,
      branch,
      pushArgs,
      pushResult: pushSuccess ? 'success' : 'failed',
      exitCode,
      statusCaptured: statusSuccess,
      gitStatus,
      output: pushOutput ? pushOutput.trim() : undefined,
      error: pushError ? pushError.trim() : undefined,
    });
  }

  const allPassed = repositories.length > 0 && repositories.every((r) => r.pushResult === 'success');
  const receiptPayload = {
    receiptType: 'push-receipt',
    overallStatus: allPassed ? 'success' : 'failed',
    manifestSource: manifest.source,
    repositoryCount: repositories.length,
    repositories,
    metadata: options.metadata || {},
  };

  const { receipt, receiptPath } = writePushReceipt(receiptPayload, options);

  return {
    receipt,
    receiptPath,
    exitCode: allPassed ? 0 : 1,
  };
}

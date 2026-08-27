#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { executePushWithReceipt } from '../src/receipts.js';

function parseCliArgs(args) {
  const inputArgs = [...args];
  let manifestPath;
  let storagePath;
  let dryRun = false;

  const manifestIdx = inputArgs.indexOf('--manifest');
  if (manifestIdx !== -1) {
    manifestPath = inputArgs[manifestIdx + 1];
    inputArgs.splice(manifestIdx, 2);
  }

  const storageIdx = inputArgs.indexOf('--storage-path');
  if (storageIdx !== -1) {
    storagePath = inputArgs[storageIdx + 1];
    inputArgs.splice(storageIdx, 2);
  }

  const dryRunIdx = inputArgs.indexOf('--dry-run');
  if (dryRunIdx !== -1) {
    dryRun = true;
    inputArgs.splice(dryRunIdx, 1);
  }

  return {
    manifestPath,
    storagePath,
    dryRun,
    pushArgs: inputArgs,
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const { manifestPath, storagePath, dryRun, pushArgs } = parseCliArgs(process.argv.slice(2));

  const options = {
    storagePath,
  };

  if (dryRun) {
    options.runGit = (cmd, args, cwd) => {
      process.stderr.write(`[DRY-RUN] ${cmd} ${args.join(' ')} (cwd: ${cwd})\n`);
      if (args[0] === 'status') {
        return { status: 0, stdout: '## dry-run-branch...origin/dry-run-branch\n', stderr: '' };
      }
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'dry-run-branch\n', stderr: '' };
      }
      return { status: 0, stdout: 'Dry run push successful', stderr: '' };
    };
  }

  const result = executePushWithReceipt({
    manifest: manifestPath,
    pushArgs,
  }, options);

  process.stdout.write(`${JSON.stringify({
    check: 'push-receipt',
    exitCode: result.exitCode,
    receiptPath: result.receiptPath,
    receipt: result.receipt,
  })}\n`);

  process.exitCode = result.exitCode;
}

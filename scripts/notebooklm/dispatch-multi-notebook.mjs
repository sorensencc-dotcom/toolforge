#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { consolidatePacks } from '../consolidate-pack.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

export function buildDispatchPlan(generatedPacks = []) {
  return generatedPacks.map(({ packDef, packFile }) => ({
    category: packDef.category,
    title: packDef.title,
    notebookId: packDef.notebookId,
    packFile,
    filename: path.basename(packFile)
  }));
}

function spawnUpload(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stderr }));
  });
}

export async function dispatchMultiNotebook(options = {}) {
  const generatedPacks = options.generatedPacks ?? consolidatePacks(options.consolidateOptions);
  const plan = buildDispatchPlan(generatedPacks);
  const limit = Math.max(1, Number(options.concurrency ?? 3));
  const results = new Array(plan.length);
  let next = 0;

  async function worker() {
    while (next < plan.length) {
      const index = next++;
      const task = plan[index];
      if (options.dryRun) {
        results[index] = { task, status: 'dry-run-ok' };
        continue;
      }
      const command = options.command ?? process.execPath;
      const script = options.uploaderScript ?? path.join(REPO_ROOT, 'notebooklm-uploader.js');
      const run = options.spawn ?? spawnUpload;
      const res = await run(command, [script, `--notebook-id=${task.notebookId}`, `--file=${task.packFile}`]);
      results[index] = { task, status: res.code === 0 ? 'success' : 'failed', exitCode: res.code, stderr: res.stderr };
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, plan.length) }, worker));
  return { success: results.every(result => result.status !== 'failed'), results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  dispatchMultiNotebook({ dryRun: process.argv.includes('--dry-run') })
    .then(result => { if (!result.success) process.exitCode = 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

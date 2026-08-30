#!/usr/bin/env node
// ==============================================================================
// NotebookLM Headless Uploader
// Uploads consolidated thematic knowledge packs to targeted NotebookLM notebooks
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = __dirname;

const COLOR = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const logInfo = (msg) => console.log(`${COLOR.green}[NLM-UPLOADER] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[NLM-UPLOADER] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.error(`${COLOR.red}[NLM-UPLOADER] [ERROR]${COLOR.reset} ${msg}`);

function loadCategories() {
  const catPath = path.join(REPO_ROOT, 'kb-sync/core/categories.json');
  if (fs.existsSync(catPath)) {
    try {
      return JSON.parse(fs.readFileSync(catPath, 'utf8'));
    } catch (e) {
      logWarn(`Failed to parse categories.json: ${e.message}`);
    }
  }
  return { categories: {} };
}

function resolveTargetNotebook() {
  // 1. Check CLI args
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--notebook=')) return arg.split('=')[1].trim();
    if (arg.startsWith('--notebook-id=')) return arg.split('=')[1].trim();
  }
  // 2. Check environment variable
  if (process.env.NOTEBOOK_ID) {
    return process.env.NOTEBOOK_ID.trim();
  }
  // 3. Check category arg
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--category=')) {
      const cat = arg.split('=')[1].trim().toLowerCase();
      const catData = loadCategories();
      if (catData.categories[cat]?.target) {
        return catData.categories[cat].target;
      }
    }
  }
  // Default to Willow Run
  return '6fd7c40b-df90-444b-9c7a-a64682925856';
}

function resolvePackFile(notebookId) {
  // Check CLI override
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--file=')) return path.resolve(REPO_ROOT, arg.split('=')[1].trim());
    if (arg.startsWith('--pack=')) return path.resolve(REPO_ROOT, arg.split('=')[1].trim());
  }

  const catData = loadCategories();
  let categoryKey = 'willow-run';
  for (const [key, catDef] of Object.entries(catData.categories || {})) {
    if (catDef.target === notebookId) {
      categoryKey = key;
      break;
    }
  }

  const safeFilename = `pack_${categoryKey.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_')}.txt`;
  return path.join(REPO_ROOT, '.nlm_pack', safeFilename);
}

function resolveNlmRunner() {
  const cliDir = path.join(REPO_ROOT, 'kb-sync/notebooklm-mcp-cli');
  const pyproject = path.join(cliDir, 'pyproject.toml');

  // Check uv
  const uvCheck = spawnSync('uv', ['--version'], { encoding: 'utf8', windowsHide: true });
  if (uvCheck.status === 0 && fs.existsSync(pyproject)) {
    return {
      exec: 'uv',
      prefixArgs: ['--directory', cliDir, 'run', 'nlm']
    };
  }

  // Check global nlm / notebooklm
  const nlmCheck = spawnSync('nlm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (nlmCheck.status === 0) {
    return { exec: 'nlm', prefixArgs: [] };
  }

  const nlmPyCheck = spawnSync('notebooklm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (nlmPyCheck.status === 0) {
    return { exec: 'notebooklm', prefixArgs: [] };
  }

  throw new Error('No NotebookLM CLI runtime available (uv or global nlm).');
}

function runNlm(runner, args, capture = false) {
  const fullArgs = [...runner.prefixArgs, ...args];
  const res = spawnSync(runner.exec, fullArgs, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (res.status !== 0 && !capture) {
    throw new Error(`Command failed with exit code ${res.status}: ${runner.exec} ${fullArgs.join(' ')}`);
  }
  return res;
}

async function main() {
  const notebookId = resolveTargetNotebook();
  const packFile = resolvePackFile(notebookId);

  logInfo(`Initializing NotebookLM Headless Uploader...`);
  logInfo(`Target Notebook ID: ${COLOR.bold}${notebookId}${COLOR.reset}`);
  logInfo(`Target Knowledge Pack: ${COLOR.bold}${packFile}${COLOR.reset}`);

  if (!fs.existsSync(packFile)) {
    logWarn(`Pack file ${packFile} does not exist. Running consolidation first...`);
    const consolidateScript = path.join(REPO_ROOT, 'scripts/consolidate-pack.mjs');
    const consRes = spawnSync('node', [consolidateScript], { stdio: 'inherit', shell: true });
    if (consRes.status !== 0 || !fs.existsSync(packFile)) {
      logError(`Failed to generate knowledge pack: ${packFile}`);
      process.exit(1);
    }
  }

  const packStats = fs.statSync(packFile);
  logInfo(`Knowledge Pack Size: ${(packStats.size / 1024).toFixed(2)} KB`);

  const runner = resolveNlmRunner();

  // Auth check
  logInfo(`Verifying NotebookLM authentication...`);
  const authRes = runNlm(runner, ['login', '--check'], true);
  if (authRes.status !== 0) {
    logError(`NotebookLM authentication check failed: ${authRes.stderr || authRes.stdout}`);
    process.exit(1);
  }
  logInfo(`✓ Authentication verified.`);

  // Step 1: Query existing sources
  logInfo(`Querying existing sources in notebook ${notebookId}...`);
  const listRes = runNlm(runner, ['source', 'list', notebookId, '--json'], true);
  let existingSources = [];
  if (listRes.status === 0 && listRes.stdout) {
    try {
      const parsed = JSON.parse(listRes.stdout);
      existingSources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
    } catch (e) {
      logWarn(`Could not parse source list JSON: ${e.message}`);
    }
  }

  const packBaseName = path.basename(packFile);
  const staleSources = existingSources.filter(s => {
    const title = (s.title || s.name || '').toLowerCase().trim();
    return title === packBaseName.toLowerCase() ||
           title.includes('willow run & aviation engineering pack') ||
           title.startsWith('pack_willow_run');
  });

  logInfo(`Found ${existingSources.length} total source(s) in notebook (${staleSources.length} prior knowledge pack versions to replace).`);

  // Step 2: Upload fresh pack (Staged upload)
  logInfo(`Uploading fresh pack '${packBaseName}' to NotebookLM...`);
  const uploadRes = runNlm(runner, ['source', 'add', notebookId, '--file', packFile], false);
  if (uploadRes.status !== 0) {
    logError(`Upload failed with exit code ${uploadRes.status}`);
    process.exit(1);
  }
  logInfo(`✓ Fresh knowledge pack successfully uploaded to NotebookLM!`);

  // Step 3: Purge stale prior pack versions
  if (staleSources.length > 0) {
    logInfo(`Purging ${staleSources.length} stale previous pack version(s)...`);
    for (const stale of staleSources) {
      logInfo(`Deleting stale source ID: ${stale.id} ("${stale.title || stale.name}")...`);
      const delRes = runNlm(runner, ['source', 'delete', stale.id, '-y'], true);
      if (delRes.status === 0) {
        logInfo(`✓ Purged stale source ${stale.id}`);
      } else {
        logWarn(`Failed to delete stale source ${stale.id}: ${delRes.stderr || delRes.stdout}`);
      }
    }
  }

  logInfo(`================================================================================`);
  logInfo(`✓ Headless upload workflow completed successfully for Notebook: ${notebookId}`);
  logInfo(`================================================================================`);
}

main().catch(err => {
  logError(`Fatal upload error: ${err.message}`);
  process.exit(1);
});

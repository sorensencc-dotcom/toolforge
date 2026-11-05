#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');

function getRunId(argv) {
  const idx = argv.indexOf('--run-id');
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1];
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEvidenceDir(runId) {
  const dir = resolve(REPO_ROOT, 'evidence', 'verify-toolforge-marketplace', runId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getIsolatedHome(runId) {
  const homeDir = resolve(getEvidenceDir(runId), 'sandbox-home');
  if (!existsSync(homeDir)) {
    mkdirSync(homeDir, { recursive: true });
  }
  return homeDir;
}

// ---------------------------------------------------------
// Subcommand: DOCTOR
// ---------------------------------------------------------
async function runDoctor(argv) {
  console.log('=== Toolforge Marketplace Doctor ===');
  const results = [];

  // Check 1: Node Version
  const nodeVer = process.versions.node;
  const major = parseInt(nodeVer.split('.')[0], 10);
  const nodeOk = major >= 18;
  results.push({
    check: 'Node.js runtime >= v18',
    status: nodeOk ? 'PASS' : 'FAIL',
    detail: `Current: v${nodeVer}`
  });

  // Check 2: Core Paths
  const cliPath = resolve(REPO_ROOT, 'src/cli/index.js');
  const apiPath = resolve(REPO_ROOT, 'src/api/server.js');
  const manifestPath = resolve(REPO_ROOT, 'manifest.json');
  const uiPath = resolve(REPO_ROOT, 'src/ui/App.jsx');

  results.push({
    check: 'CLI entrypoint exists',
    status: existsSync(cliPath) ? 'PASS' : 'FAIL',
    detail: cliPath
  });

  results.push({
    check: 'API server module exists',
    status: existsSync(apiPath) ? 'PASS' : 'FAIL',
    detail: apiPath
  });

  results.push({
    check: 'Marketplace manifest exists and parses',
    status: existsSync(manifestPath) ? 'PASS' : 'FAIL',
    detail: manifestPath
  });

  // Check 3: CLI Help Invocation
  let cliHelpOk = false;
  let cliDetail = '';
  try {
    const out = execSync(`node "${cliPath}" --help`, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 5000 });
    cliHelpOk = out.includes('Commands:') && out.includes('install') && out.includes('plugins');
    cliDetail = cliHelpOk ? 'Responded with command catalogue' : 'Help output did not contain expected commands';
  } catch (err) {
    cliDetail = err.message;
  }
  results.push({
    check: 'CLI binary executable and syntax valid',
    status: cliHelpOk ? 'PASS' : 'FAIL',
    detail: cliDetail
  });

  // Check 4: Manifest Integrity
  let manifestOk = false;
  let skillCount = 0;
  try {
    const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (Array.isArray(data.skills) && data.skills.length > 0) {
      manifestOk = true;
      skillCount = data.skills.length;
    }
  } catch (e) {
    manifestOk = false;
  }
  results.push({
    check: 'Manifest skills schema valid',
    status: manifestOk ? 'PASS' : 'FAIL',
    detail: `${skillCount} skills registered`
  });

  // Print results
  let allPass = true;
  for (const r of results) {
    console.log(`[${r.status}] ${r.check}: ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  const runId = getRunId(argv);
  const evidenceDir = getEvidenceDir(runId);
  const reportPath = join(evidenceDir, 'doctor-report.json');
  writeFileSync(reportPath, JSON.stringify({ runId, timestamp: new Date().toISOString(), allPass, results }, null, 2));
  console.log(`\nDoctor report written to: ${reportPath}`);

  if (!allPass) {
    process.exit(1);
  }
}

// ---------------------------------------------------------
// Subcommand: CLI EXECUTION
// ---------------------------------------------------------
async function runCli(argv) {
  const cliArgsIndex = argv.indexOf('--');
  const cliArgs = cliArgsIndex !== -1 ? argv.slice(cliArgsIndex + 1) : argv.slice(3);

  const runId = getRunId(argv);
  const isolatedHome = getIsolatedHome(runId);
  const evidenceDir = getEvidenceDir(runId);
  const cliPath = resolve(REPO_ROOT, 'src/cli/index.js');

  const env = {
    ...process.env,
    USERPROFILE: isolatedHome,
    HOME: isolatedHome,
    USER: 'verify-agent'
  };

  const child = spawn(process.execPath, [cliPath, ...cliArgs], {
    cwd: REPO_ROOT,
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => {
    const chunk = d.toString();
    stdout += chunk;
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (d) => {
    const chunk = d.toString();
    stderr += chunk;
    process.stderr.write(chunk);
  });

  child.on('close', (code) => {
    const record = {
      runId,
      timestamp: new Date().toISOString(),
      command: ['node', cliPath, ...cliArgs].join(' '),
      exitCode: code,
      stdout,
      stderr
    };
    const logPath = join(evidenceDir, `cli-${Date.now()}.json`);
    writeFileSync(logPath, JSON.stringify(record, null, 2));
    process.exit(code || 0);
  });
}

// ---------------------------------------------------------
// Subcommand: DRIVE FEATURE
// ---------------------------------------------------------
async function runDrive(argv) {
  const featureName = argv[3];
  if (!featureName) {
    console.error('Usage: control-marketplace.mjs drive <plugin-lifecycle|manifest-validation> [--run-id <id>]');
    process.exit(1);
  }

  const runId = getRunId(argv);
  const evidenceDir = getEvidenceDir(runId);
  const isolatedHome = getIsolatedHome(runId);

  console.log(`Driving feature: ${featureName} (Run ID: ${runId})`);

  if (featureName === 'plugin-lifecycle') {
    // 1. Create a isolated disposable test plugin
    const pluginDir = join(evidenceDir, 'sample-echo-plugin');
    mkdirSync(pluginDir, { recursive: true });

    writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify({
      id: 'verify-echo',
      name: 'Verify Echo',
      version: '1.0.0',
      entrypoint: 'index.js',
      commands: {
        echo: {
          argsSchema: 'v1',
          args: [{ name: 'msg', required: true }]
        }
      }
    }, null, 2));

    writeFileSync(join(pluginDir, 'index.js'), `
      export function echo({ msg }) {
        return { reply: msg, receivedAt: new Date().toISOString() };
      }
    `);

    const cliPath = resolve(REPO_ROOT, 'src/cli/index.js');
    const env = {
      ...process.env,
      USERPROFILE: isolatedHome,
      HOME: isolatedHome,
      USER: 'verify-agent'
    };

    // Step A: plugins add
    console.log('Action 1: Registering plugin via `plugins add`...');
    const addOut = execSync(`node "${cliPath}" plugins add "${pluginDir}"`, { cwd: REPO_ROOT, env, encoding: 'utf8' });
    console.log(addOut.trim());
    if (!addOut.includes('Successfully registered plugin Verify Echo')) {
      throw new Error(`Failed to register plugin: ${addOut}`);
    }

    // Step B: plugins list
    console.log('\nAction 2: Listing plugins via `plugins list`...');
    const listOut = execSync(`node "${cliPath}" plugins list`, { cwd: REPO_ROOT, env, encoding: 'utf8' });
    console.log(listOut.trim());
    if (!listOut.includes('Verify Echo (verify-echo)')) {
      throw new Error(`Plugin not found in list: ${listOut}`);
    }

    // Step C: exec command
    console.log('\nAction 3: Executing plugin command via `exec`...');
    const execOut = execSync(`node "${cliPath}" exec verify-echo echo "verification-token-42"`, { cwd: REPO_ROOT, env, encoding: 'utf8' });
    console.log(execOut.trim());
    const parsed = JSON.parse(execOut.trim());
    if (parsed.reply !== 'verification-token-42') {
      throw new Error(`Unexpected exec reply: ${execOut}`);
    }

    // Step D: plugins remove
    console.log('\nAction 4: Removing plugin via `plugins remove`...');
    const removeOut = execSync(`node "${cliPath}" plugins remove verify-echo`, { cwd: REPO_ROOT, env, encoding: 'utf8' });
    console.log(removeOut.trim());
    if (!removeOut.includes('Successfully removed plugin verify-echo')) {
      throw new Error(`Failed to remove plugin: ${removeOut}`);
    }

    // Step E: confirm empty list
    const finalList = execSync(`node "${cliPath}" plugins list`, { cwd: REPO_ROOT, env, encoding: 'utf8' });
    if (finalList.includes('verify-echo')) {
      throw new Error('Plugin still present after remove');
    }

    // Write Proof Artifact
    const proofPath = join(evidenceDir, 'plugin-lifecycle-proof.json');
    const proof = {
      feature: 'plugin-lifecycle',
      runId,
      timestamp: new Date().toISOString(),
      verdict: 'PASS',
      steps: [
        { step: 'register', output: addOut.trim() },
        { step: 'list', output: listOut.trim() },
        { step: 'exec', output: parsed },
        { step: 'remove', output: removeOut.trim() },
        { step: 'verify_empty', output: finalList.trim() }
      ]
    };
    writeFileSync(proofPath, JSON.stringify(proof, null, 2));
    console.log(`\n✓ Feature verification complete. Proof saved to: ${proofPath}`);

  } else if (featureName === 'manifest-validation') {
    console.log('Action: Running manifest and semver validators...');
    const testOut = execSync('node --test src/validators/manifest.test.js src/validators/semver.test.js', {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });
    console.log(testOut.trim());

    const proofPath = join(evidenceDir, 'manifest-validation-proof.json');
    const proof = {
      feature: 'manifest-validation',
      runId,
      timestamp: new Date().toISOString(),
      verdict: testOut.includes('fail 0') ? 'PASS' : 'FAIL',
      testSummary: testOut.split('\n').filter(l => l.startsWith('ℹ') || l.includes('pass')).join('\n')
    };
    writeFileSync(proofPath, JSON.stringify(proof, null, 2));
    console.log(`\n✓ Manifest validation complete. Proof saved to: ${proofPath}`);

  } else {
    console.error(`Unknown feature: ${featureName}. Supported: plugin-lifecycle, manifest-validation`);
    process.exit(1);
  }
}

// ---------------------------------------------------------
// Subcommand: CLEANUP
// ---------------------------------------------------------
async function runCleanup(argv) {
  const runId = getRunId(argv);
  const evidenceDir = resolve(REPO_ROOT, 'evidence', 'verify-toolforge-marketplace', runId);
  console.log(`Cleaning up verification session: ${runId}`);

  // Kill running server if pid is recorded
  const statePath = join(evidenceDir, 'run-state.json');
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      if (state.pid) {
        console.log(`Stopping verification server process PID ${state.pid}...`);
        try {
          process.kill(state.pid);
        } catch {
          // already exited
        }
      }
    } catch {
      // ignore
    }
  }

  // Clean scratch directories in sandbox-home without touching proof JSONs
  const sandboxHome = join(evidenceDir, 'sandbox-home');
  if (existsSync(sandboxHome)) {
    try {
      rmSync(sandboxHome, { recursive: true, force: true });
      console.log('Cleared disposable sandbox-home.');
    } catch (e) {
      console.warn(`Could not clear sandbox-home: ${e.message}`);
    }
  }

  // Remove sample plugin source directory if present
  const samplePlugin = join(evidenceDir, 'sample-echo-plugin');
  if (existsSync(samplePlugin)) {
    try {
      rmSync(samplePlugin, { recursive: true, force: true });
      console.log('Cleared temporary sample-plugin source.');
    } catch (e) {
      console.warn(`Could not clear sample-plugin source: ${e.message}`);
    }
  }

  console.log(`Teardown complete. Proof evidence preserved at: ${evidenceDir}`);
}

// ---------------------------------------------------------
// MAIN ROUTER
// ---------------------------------------------------------
const command = process.argv[2];

switch (command) {
  case 'doctor':
    await runDoctor(process.argv);
    break;
  case 'cli':
    await runCli(process.argv);
    break;
  case 'drive':
    await runDrive(process.argv);
    break;
  case 'cleanup':
    await runCleanup(process.argv);
    break;
  default:
    console.log(`Toolforge Marketplace Verification Harness
Usage:
  control-marketplace.mjs doctor [--run-id <id>]
  control-marketplace.mjs cli -- <cli-command-and-args> [--run-id <id>]
  control-marketplace.mjs drive <feature-name> [--run-id <id>]
  control-marketplace.mjs cleanup [--run-id <id>]
`);
    break;
}

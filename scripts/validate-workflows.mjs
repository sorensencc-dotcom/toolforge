#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');

if (!fs.existsSync(workflowsDir)) {
  console.log('[WORKFLOW-VALIDATOR] No .github/workflows directory found. Skipping.');
  process.exit(0);
}

const workflowFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
const lockfileExists = fs.existsSync(path.join(repoRoot, 'package-lock.json'));

let hasErrors = false;

for (const file of workflowFiles) {
  const filePath = path.join(workflowsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check for deprecated Node.js versions
    const nodeVersionMatch = line.match(/node-version:\s*['"]?(\d+)['"]?/);
    if (nodeVersionMatch) {
      const version = parseInt(nodeVersionMatch[1], 10);
      if (version < 24) {
        console.error(`[WORKFLOW-VALIDATOR] ✘ ${file}:${lineNum} - Deprecated or unsupported node-version: ${version}. Minimum supported version is 24.`);
        hasErrors = true;
      }
    }

    // Check for npm lockfile cache without committed lockfile
    if (!lockfileExists && /cache:\s*['"]npm['"]/.test(line)) {
      console.error(`[WORKFLOW-VALIDATOR] ✘ ${file}:${lineNum} - 'cache: npm' used without committed package-lock.json (which is gitignored).`);
      hasErrors = true;
    }

    // Check for raw npm ci without fallback when lockfile is gitignored
    if (!lockfileExists && /^\s*run:\s*npm\s+ci\s*$/.test(line)) {
      console.error(`[WORKFLOW-VALIDATOR] ✘ ${file}:${lineNum} - 'npm ci' will fail on GitHub runners because package-lock.json is gitignored. Use 'npm ci || npm install' or 'npm install'.`);
      hasErrors = true;
    }
  });
}

if (hasErrors) {
  console.error('\n[WORKFLOW-VALIDATOR] [FAIL] GitHub Actions workflow validation failed. Please fix the errors above.');
  process.exit(1);
}

console.log(`[WORKFLOW-VALIDATOR] ✔ [PASS] All ${workflowFiles.length} workflow files validated against runtime and lockfile rules.`);
process.exit(0);

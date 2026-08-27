#!/usr/bin/env node
/**
 * setup-git-hook.mjs
 *
 * Installs the pre-commit hook in .git/hooks/pre-commit across platforms.
 * Sets executable permissions (0o755) for Git Bash / WSL2 / Linux on Windows.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export function findGitRoot(startDir) {
  let curr = path.resolve(startDir);
  while (curr) {
    const gitPath = path.join(curr, '.git');
    if (fs.existsSync(gitPath)) return gitPath;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

export function installGitHook(targetDir = REPO_ROOT) {
  const gitDir = findGitRoot(targetDir);
  if (!gitDir) {
    console.warn(`[WARN] .git directory not found in hierarchy starting at ${targetDir}. Skipping hook installation.`);
    return { success: false, hookPath: null };
  }

  const gitHooksDir = fs.statSync(gitDir).isDirectory()
    ? path.join(gitDir, 'hooks')
    : path.join(path.dirname(gitDir), '.git', 'hooks');
  const hookPath = path.join(gitHooksDir, 'pre-commit');

  // Create .git/hooks directory if absent
  fs.mkdirSync(gitHooksDir, { recursive: true });

  const shimPath = path.join(__dirname, 'pre-commit-shim.sh');
  const hookContent = fs.readFileSync(shimPath, 'utf8');

  fs.writeFileSync(hookPath, hookContent, 'utf8');

  // Set executable permissions for Unix/WSL/Git Bash
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch (err) {
    // Ignored on systems without posix permissions
  }

  return { success: true, hookPath, gitHooksDir };
}

function parseTargetArg(args) {
  const targetIndex = args.indexOf('--target');
  if (targetIndex !== -1 && args[targetIndex + 1]) {
    return path.resolve(args[targetIndex + 1]);
  }
  if (args.length > 0 && !args[0].startsWith('-')) {
    return path.resolve(args[0]);
  }
  return REPO_ROOT;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  const targetDir = parseTargetArg(process.argv.slice(2));
  const result = installGitHook(targetDir);
  if (result.success) {
    console.log(`✔ Successfully installed pre-commit hook at: ${result.hookPath}`);
  } else {
    process.exit(0);
  }
}

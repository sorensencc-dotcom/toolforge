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

function findGitRoot(startDir) {
  let curr = startDir;
  while (curr) {
    const gitPath = path.join(curr, '.git');
    if (fs.existsSync(gitPath)) return gitPath;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

const gitDir = findGitRoot(REPO_ROOT);
if (!gitDir) {
  console.warn(`[WARN] .git directory not found in hierarchy starting at ${REPO_ROOT}. Skipping hook installation.`);
  process.exit(0);
}

const gitHooksDir = fs.statSync(gitDir).isDirectory() ? path.join(gitDir, 'hooks') : path.join(REPO_ROOT, '.git', 'hooks');
const hookPath = path.join(gitHooksDir, 'pre-commit');

// Create .git/hooks directory if absent
fs.mkdirSync(gitHooksDir, { recursive: true });

const hookContent = `#!/usr/bin/env bash
# Installed by npm run gov:setup-hook
if [ -f "CIC-GOVERNANCE/scripts/governance-validate-precommit.sh" ]; then
  exec bash CIC-GOVERNANCE/scripts/governance-validate-precommit.sh
elif [ -f "scripts/governance-validate-precommit.sh" ]; then
  exec bash scripts/governance-validate-precommit.sh
fi
`;

fs.writeFileSync(hookPath, hookContent, 'utf8');

// Set executable permissions for Unix/WSL/Git Bash
try {
  fs.chmodSync(hookPath, 0o755);
} catch (err) {
  // Ignored on systems without posix permissions
}

console.log(`✔ Successfully installed pre-commit hook at: ${hookPath}`);

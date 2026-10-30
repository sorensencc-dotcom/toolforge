import fs from 'node:fs';
import path from 'node:path';

const WIKI_CHECK_SNIPPET = `
# Pre-push wiki dry-run check for repository documentation
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
PUBLISH_SCRIPT="C:/dev/scripts/publish-repo-wiki-pages.mjs"
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/scripts/sync-wiki.mjs" ]; then
  if ! node "$REPO_ROOT/scripts/sync-wiki.mjs" --dry-run; then
    echo -e "\\033[31m[Hook Fail]\\033[0m Repo wiki dry-run check failed. Push blocked."
    exit 1
  fi
elif [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/scripts/publish-repo-wiki-pages.mjs" ]; then
  if ! node "$REPO_ROOT/scripts/publish-repo-wiki-pages.mjs" --if-changed --dry-run; then
    echo -e "\\033[31m[Hook Fail]\\033[0m Repo wiki dry-run check failed. Push blocked."
    exit 1
  fi
elif [ -f "$PUBLISH_SCRIPT" ]; then
  if ! REPO_ROOT="$REPO_ROOT" node "$PUBLISH_SCRIPT" --if-changed --dry-run; then
    echo -e "\\033[31m[Hook Fail]\\033[0m Repo wiki dry-run check failed. Push blocked."
    exit 1
  fi
fi
`;

const STANDALONE_PRE_PUSH = `#!/bin/bash
# Pre-push hook: dry-run publish repo wiki pages
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
PUBLISH_SCRIPT="C:/dev/scripts/publish-repo-wiki-pages.mjs"
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/scripts/sync-wiki.mjs" ]; then
  if ! node "$REPO_ROOT/scripts/sync-wiki.mjs" --dry-run; then
    echo -e "\\033[31m[Hook Fail]\\033[0m Repo wiki dry-run check failed. Push blocked."
    exit 1
  fi
elif [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/scripts/publish-repo-wiki-pages.mjs" ]; then
  if ! node "$REPO_ROOT/scripts/publish-repo-wiki-pages.mjs" --if-changed --dry-run; then
    echo -e "\\033[31m[Hook Fail]\\033[0m Repo wiki dry-run check failed. Push blocked."
    exit 1
  fi
elif [ -f "$PUBLISH_SCRIPT" ]; then
  if ! REPO_ROOT="$REPO_ROOT" node "$PUBLISH_SCRIPT" --if-changed --dry-run; then
    echo -e "\\033[31m[Hook Fail]\\033[0m Repo wiki dry-run check failed. Push blocked."
    exit 1
  fi
fi
exit 0
`;

export function findGitRepos(baseDir, maxDepth = 2) {
  const repos = [];
  function scan(dir, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const gitEntry = entries.find((e) => e.name === '.git');
      if (gitEntry) {
        repos.push(dir);
        if (dir !== 'C:/dev' && dir !== 'C:\\dev') return;
      }
      for (const e of entries) {
        if (e.isDirectory() && e.name !== '.git' && e.name !== 'node_modules' && !e.name.startsWith('.tmp')) {
          scan(path.join(dir, e.name), depth + 1);
        }
      }
    } catch {}
  }
  scan(baseDir, 0);
  return repos;
}

export function getHookTargetDirs(repoDir) {
  const targetDirs = new Set();
  const gitPath = path.join(repoDir, '.git');
  let configPath = null;

  try {
    const stat = fs.statSync(gitPath);
    if (stat.isFile()) {
      // Worktree pointer file
      const content = fs.readFileSync(gitPath, 'utf8');
      const match = content.match(/gitdir:\s*(.+)/);
      if (match) {
        const gitDir = path.resolve(repoDir, match[1].trim());
        configPath = path.join(gitDir, 'config');
        const commonDir = gitDir.includes('worktrees') ? path.resolve(gitDir.split('worktrees')[0]) : gitDir;
        targetDirs.add(path.join(commonDir, 'hooks'));
      }
    } else if (stat.isDirectory()) {
      targetDirs.add(path.join(gitPath, 'hooks'));
      configPath = path.join(gitPath, 'config');
    }
  } catch {}

  // Check config for core.hooksPath
  if (configPath && fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const match = configContent.match(/^\s*hooksPath\s*=\s*(.+)$/m);
      if (match) {
        const customHooks = match[1].trim();
        targetDirs.add(path.resolve(repoDir, customHooks));
      }
    } catch {}
  }

  // If repo has a .githooks directory, include it
  const repoGithooks = path.join(repoDir, '.githooks');
  if (fs.existsSync(repoGithooks)) {
    targetDirs.add(repoGithooks);
  }

  return Array.from(targetDirs);
}

export function installPrePushHookInDir(hookDir) {
  fs.mkdirSync(hookDir, { recursive: true });
  const hookFile = path.join(hookDir, 'pre-push');
  if (!fs.existsSync(hookFile)) {
    fs.writeFileSync(hookFile, STANDALONE_PRE_PUSH.replace(/\r\n/g, '\n'), { encoding: 'utf8', mode: 0o755 });
    return { file: hookFile, status: 'created' };
  }

  const existing = fs.readFileSync(hookFile, 'utf8');
  if (existing.includes('REPO_ROOT="$REPO_ROOT"') || existing.includes('sync-wiki.mjs')) {
    return { file: hookFile, status: 'already-present' };
  }

  // If this hook has the old toolforge-only snippet, upgrade it
  if (existing.includes('publish-repo-wiki-pages.mjs')) {
    if (existing.trim().startsWith('#!/bin/bash\n# Pre-push hook: dry-run publish repo wiki pages strictly targeting toolforge.wiki.git')) {
      fs.writeFileSync(hookFile, STANDALONE_PRE_PUSH.replace(/\r\n/g, '\n'), { encoding: 'utf8', mode: 0o755 });
      return { file: hookFile, status: 'updated' };
    }
    // Replace old snippet inside existing hook
    const oldSnippetPattern = /# Pre-push wiki dry-run check \(strictly targets toolforge\.wiki\.git\)[\s\S]*?if ! node "\$PUBLISH_SCRIPT" --if-changed --dry-run; then[\s\S]*?fi\s*fi/m;
    if (oldSnippetPattern.test(existing)) {
      const replaced = existing.replace(oldSnippetPattern, WIKI_CHECK_SNIPPET.trim());
      fs.writeFileSync(hookFile, replaced.replace(/\r\n/g, '\n'), { encoding: 'utf8', mode: 0o755 });
      return { file: hookFile, status: 'updated' };
    }
  }

  // Append snippet before final exit 0 if present, or at the end
  let updated;
  const trimmed = existing.trimEnd();
  if (trimmed.endsWith('exit 0')) {
    const beforeExit = trimmed.slice(0, trimmed.length - 'exit 0'.length).trimEnd();
    updated = `${beforeExit}\n${WIKI_CHECK_SNIPPET}\nexit 0\n`;
  } else {
    updated = `${trimmed}\n${WIKI_CHECK_SNIPPET}\n`;
  }

  fs.writeFileSync(hookFile, updated.replace(/\r\n/g, '\n'), { encoding: 'utf8', mode: 0o755 });
  return { file: hookFile, status: 'appended' };
}

export function installAllHooks() {
  const roots = ['C:/dev', 'C:/Users/soren'];
  const allRepos = [];
  for (const root of roots) {
    if (fs.existsSync(root)) {
      allRepos.push(...findGitRepos(root));
    }
  }

  const dedupeRepos = Array.from(new Set(allRepos.map((r) => path.resolve(r))));
  console.log(`Scanning ${dedupeRepos.length} repositories...`);

  let createdCount = 0;
  let appendedCount = 0;
  let skippedCount = 0;

  for (const repo of dedupeRepos) {
    const hookDirs = getHookTargetDirs(repo);
    for (const hookDir of hookDirs) {
      try {
        const res = installPrePushHookInDir(hookDir);
        if (res.status === 'created') createdCount++;
        else if (res.status === 'appended') appendedCount++;
        else skippedCount++;
      } catch (err) {
        console.error(`Error installing hook in ${hookDir}:`, err.message);
      }
    }
  }

  console.log(`Installation summary:`);
  console.log(`  - Newly created: ${createdCount}`);
  console.log(`  - Appended to existing: ${appendedCount}`);
  console.log(`  - Already present: ${skippedCount}`);
}

if (process.argv[1] && process.argv[1].endsWith('install-all-prepush-wiki-hooks.mjs')) {
  installAllHooks();
}

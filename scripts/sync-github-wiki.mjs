#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const value = (name, fallback = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };

const repoUrl = value('--repo-url', process.env.WIKI_REPO_URL || 'https://github.com/sorensencc-dotcom/toolforge.wiki.git');
const targetWikiDir = path.resolve(root, value('--target-dir', '.wiki-publish-temp'));
const shouldPush = args.includes('--push') || process.env.AUTO_PUSH === 'true' || true;
const commitMessage = value('--commit-msg', 'docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  let copied = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.tmp.driveupload') continue;
      fs.mkdirSync(destPath, { recursive: true });
      copied += copyRecursive(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied += 1;
    }
  }
  return copied;
}

function generateSidebar(wikiDir) {
  const sidebar = `### Toolforge Platform
- [[Home]]
- [[Quickstart|QUICKSTART]]
- [[Tool Index|INDEX]]
- [[Governance & Lifecycle|GOVERNANCE]]

#### Operational Guides
- [[Tool Creation Guide|TOOL_CREATION_GUIDE]]
- [[Operator Guide|OPERATOR_GUIDE]]
- [[Operator Commands|OPERATOR-COMMANDS]]
- [[Production Prerequisites|PRODUCTION_PREREQUISITES]]
- [[Ollama Deployment Guide|OLLAMA_DEPLOYMENT_GUIDE]]
- [[Ollama Provider Setup|OLLAMA_PROVIDER_SETUP]]
- [[Rollback Runbook|docs/ROLLBACK_RUNBOOK]]

#### Model Evaluation & WhichLLM
- [[WhichLLM Model Selection Evaluator|wiki/research/whichllm-model-selection-evaluator]]
- [[Research Gaps Registry|trm-research-gaps]]

#### TRM & Competitor Monitoring
- [[Competitor Watchlist Drift Engine|wiki/research/competitor-watchlist-drift-engine]]
- [[Historical Revocation Verification|wiki/research/historical-revocation-verification]]
- [[Mobile WebSocket Heartbeats|wiki/research/mobile-websocket-heartbeats]]

#### Architecture & Subsystems
- [[Knowledge Base Sync (kb-sync)|kb-sync/README]]
- [[KB Sync DAG Structure|docs/KB_SYNC_DAG]]
- [[Documentation Catalog|docs/DOCS_INDEX]]
- [[Audit Log|wiki/Log]]
`;

  fs.writeFileSync(path.join(wikiDir, '_Sidebar.md'), sidebar, 'utf8');
}

function generateFooter(wikiDir) {
  const footerContent = `---\n*Toolforge Platform Documentation Wiki • Synchronized at ${new Date().toISOString()}*`;
  fs.writeFileSync(path.join(wikiDir, '_Footer.md'), footerContent, 'utf8');
}

function generateHome(wikiDir) {
  const readmePath = path.join(root, 'README.md');
  let homeContent = '';
  if (fs.existsSync(readmePath)) {
    homeContent = fs.readFileSync(readmePath, 'utf8');
  } else {
    homeContent = `# Toolforge Platform Wiki\n\nWelcome to the official Toolforge Platform Wiki.`;
  }
  fs.writeFileSync(path.join(wikiDir, 'Home.md'), homeContent, 'utf8');
}

async function main() {
  console.log(`=== [TOOLFORGE WIKI PUBLISHER] ===`);
  console.log(`Workspace root: ${root}`);
  console.log(`Target publish directory: ${targetWikiDir}`);
  console.log(`Remote Wiki Repository: ${repoUrl}`);

  // 1. Prepare target clone
  if (fs.existsSync(targetWikiDir)) {
    fs.rmSync(targetWikiDir, { recursive: true, force: true });
  }

  console.log(`Cloning remote wiki git repository...`);
  execSync(`git clone "${repoUrl}" "${targetWikiDir}"`, { stdio: 'inherit' });

  // 2. Copy root guides
  console.log(`Copying root governance & guide documents...`);
  const rootFiles = [
    'GOVERNANCE.md',
    'INDEX.md',
    'QUICKSTART.md',
    'CHECKLIST.md',
    'TOOL_CREATION_GUIDE.md',
    'OLLAMA_DEPLOYMENT_GUIDE.md',
    'OLLAMA_PROVIDER_SETUP.md',
    'OPERATOR-COMMANDS.md',
    'OPERATOR_GUIDE.md',
    'PRODUCTION_PREREQUISITES.md',
    'trm-research-gaps.md'
  ];

  for (const rf of rootFiles) {
    const src = path.join(root, rf);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetWikiDir, rf));
    }
  }

  // 3. Copy docs/ and wiki/ directories
  console.log(`Copying docs/ and wiki/ markdown trees...`);
  copyRecursive(path.join(root, 'docs'), path.join(targetWikiDir, 'docs'));
  copyRecursive(path.join(root, 'wiki'), path.join(targetWikiDir, 'wiki'));
  
  // Also copy kb-sync README for direct sub-system reference
  if (fs.existsSync(path.join(root, 'kb-sync', 'README.md'))) {
    fs.mkdirSync(path.join(targetWikiDir, 'kb-sync'), { recursive: true });
    fs.copyFileSync(path.join(root, 'kb-sync', 'README.md'), path.join(targetWikiDir, 'kb-sync', 'README.md'));
  }

  // 4. Generate Home, Sidebar, and Footer
  console.log(`Generating Home.md, _Sidebar.md, and _Footer.md...`);
  generateHome(targetWikiDir);
  generateSidebar(targetWikiDir);
  generateFooter(targetWikiDir);

  // 5. Commit and push
  if (shouldPush) {
    console.log(`Checking working tree in target wiki...`);
    execSync('git add -A', { cwd: targetWikiDir, stdio: 'pipe' });
    const status = execSync('git status --porcelain', { cwd: targetWikiDir, encoding: 'utf8' }).trim();

    if (status) {
      console.log(`Committing wiki updates...`);
      execSync(`git commit -m "${commitMessage}"`, { cwd: targetWikiDir, stdio: 'inherit' });
      console.log(`Pushing to ${repoUrl}...`);
      execSync('git push origin HEAD', { cwd: targetWikiDir, stdio: 'inherit' });
      console.log(`\n🎉 SUCCESS: GitHub Wiki for toolforge is now fully published and live!`);
    } else {
      console.log(`✓ GitHub Wiki working tree is already up to date with remote.`);
    }
  }

  // Cleanup temp dir
  try {
    fs.rmSync(targetWikiDir, { recursive: true, force: true });
  } catch {}
}

main().catch(err => {
  console.error(`Fatal wiki publish failure: ${err.message}`);
  process.exit(1);
});

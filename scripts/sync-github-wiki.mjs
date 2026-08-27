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
      if (entry.name === 'archive' && src === path.join(root, 'docs')) continue;
      fs.mkdirSync(destPath, { recursive: true });
      copied += copyRecursive(srcPath, destPath);
    } else if (entry.isFile() && /\.(md|png|svg|jpg|jpeg|gif|mermaid)$/i.test(entry.name)) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const content = fs.readFileSync(srcPath);
      fs.writeFileSync(destPath, entry.name.toLowerCase().endsWith('.md') ? addFrontmatterTitle(content.toString('utf8')) : content);
      copied += 1;
    }
  }
  return copied;
}

function addFrontmatterTitle(content) {
  if (!content.startsWith('---\n')) return content;
  const closing = content.indexOf('\n---', 4);
  if (closing < 0) return content;
  const frontmatter = content.slice(4, closing);
  const match = frontmatter.match(/^(?:title|source_title):\s*["']?(.+?)["']?\s*$/m);
  if (!match || /^#\s/m.test(content.slice(closing + 4))) return content;
  const title = match[1].replace(/["']$/, '').trim();
  return `${content.slice(0, closing + 4)}\n\n# ${title}\n${content.slice(closing + 4)}`;
}

function validateMarkdownImages(wikiDir) {
  const missing = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.md')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const match of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
          const target = match[1].trim().split(/\s+/)[0];
          if (/^(?:https?:|data:|#)/i.test(target)) continue;
          if (!fs.existsSync(path.resolve(path.dirname(full), target))) missing.push(`${path.relative(wikiDir, full)} -> ${target}`);
        }
      }
    }
  }
  walk(wikiDir);
  if (missing.length) throw new Error(`Missing local Markdown image targets:\n${missing.join('\n')}`);
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
- [[Rollback Runbook|ROLLBACK_RUNBOOK]]

#### Model Evaluation & WhichLLM
- [[WhichLLM Model Selection Evaluator|whichllm-model-selection-evaluator]]
- [[Research Gaps Registry|trm-research-gaps]]

#### TRM & Competitor Monitoring
- [[Competitor Watchlist Drift Engine|competitor-watchlist-drift-engine]]
- [[Historical Revocation Verification|historical-revocation-verification]]
- [[Mobile WebSocket Heartbeats|mobile-websocket-heartbeats]]

#### Architecture & Subsystems
- [[Knowledge Base Sync (kb-sync)|kb-sync-readme]]
- [[KB Sync DAG Structure|KB_SYNC_DAG]]
- [[Documentation Catalog|DOCS_INDEX]]
- [[Audit Log|Log]]
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

  // Historical archives are not published to the Wiki and may remain from older syncs.
  const archivedWikiDocs = path.join(targetWikiDir, 'docs', 'archive');
  if (fs.existsSync(archivedWikiDocs)) fs.rmSync(archivedWikiDocs, { recursive: true, force: true });

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

  // Copy specific pages to root of Wiki repo for GitHub Wiki routing
  const rootPageMappings = [
    { src: 'wiki/toolforge-architecture-overview.html', dest: 'toolforge-architecture-overview.html' },
    { src: 'wiki/toolforge-architecture-overview.png', dest: 'toolforge-architecture-overview.png' },
    { src: 'wiki/research/whichllm-model-selection-evaluator.md', dest: 'whichllm-model-selection-evaluator.md' },
    { src: 'wiki/research/whichllm-architecture-topology.png', dest: 'whichllm-architecture-topology.png' },
    { src: 'wiki/research/whichllm-architecture-topology.html', dest: 'whichllm-architecture-topology.html' },
    { src: 'wiki/research/competitor-watchlist-drift-engine.md', dest: 'competitor-watchlist-drift-engine.md' },
    { src: 'wiki/research/historical-revocation-verification.md', dest: 'historical-revocation-verification.md' },
    { src: 'wiki/research/mobile-websocket-heartbeats.md', dest: 'mobile-websocket-heartbeats.md' },
    { src: 'docs/ROLLBACK_RUNBOOK.md', dest: 'ROLLBACK_RUNBOOK.md' },
    { src: 'docs/KB_SYNC_DAG.md', dest: 'KB_SYNC_DAG.md' },
    { src: 'docs/DOCS_INDEX.md', dest: 'DOCS_INDEX.md' },
    { src: 'kb-sync/README.md', dest: 'kb-sync-readme.md' },
    { src: 'trm-gap-triage-architecture.png', dest: 'trm-gap-triage-architecture.png' },
    { src: 'trm-gap-triage-architecture.png', dest: 'kb-sync/trm-gap-triage-architecture.png' },
    { src: 'trm-gap-triage-architecture.html', dest: 'trm-gap-triage-architecture.html' },
    { src: 'wiki/Log.md', dest: 'Log.md' },
  ];

  for (const map of rootPageMappings) {
    const src = path.join(root, map.src);
    if (fs.existsSync(src)) {
      const destPath = path.join(targetWikiDir, map.dest);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(src, destPath);
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
  validateMarkdownImages(targetWikiDir);

  // 5. Commit and push
  if (shouldPush) {
    console.log(`Checking working tree in target wiki...`);
    execSync('git add -A', { cwd: targetWikiDir, stdio: 'pipe' });
    const status = execSync('git status --porcelain', { cwd: targetWikiDir, encoding: 'utf8' }).trim();

    if (status) {
      console.log(`Committing wiki updates...`);
      execSync(`git -c core.hooksPath=.git/no-hooks commit -m "${commitMessage}"`, { cwd: targetWikiDir, stdio: 'inherit' });
      console.log(`Pushing to ${repoUrl}...`);
      execSync('git -c core.hooksPath=.git/no-hooks push origin HEAD', { cwd: targetWikiDir, stdio: 'inherit' });
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

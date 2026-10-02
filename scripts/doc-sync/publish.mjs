// scripts/doc-sync/publish.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { stageMirror } from './stage-mirror.mjs';
import { findForeignSidebarLinks } from './sidebar-guard.mjs';

const SH_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
const defaultSh = (cmd, cwd) => execSync(cmd, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: SH_ENV,
  timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
}).trim();
const GIT = 'git -c core.hooksPath=.git/no-hooks -c user.name=doc-sync -c user.email=doc-sync@localhost';

function step(sh, label, cmd, cwd) {
  try {
    return sh(cmd, cwd);
  } catch (err) {
    throw new Error(`${label}: ${(err.stderr || err.message || '').toString().trim().slice(0, 500)}`);
  }
}

function countPages(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md') && !path.join(e.parentPath ?? e.path, e.name).includes(`${path.sep}.git${path.sep}`))
    .length;
}

export async function publishProduct(product, { dryRun = false, sh = defaultSh, onPublished } = {}) {
  const result = { product: product.name, status: 'FAILED', changed: [], deleted: [], pages: 0 };
  const temps = [];
  const mkTemp = (tag) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `doc-sync-${product.name}-${tag}-`));
    temps.push(dir);
    return dir;
  };
  try {
    if (product.preValidate) step(sh, 'PREVALIDATE_FAILED', product.preValidate, product.repoPath);

    let pagesDir;
    if (product.buildCommand) {
      pagesDir = mkTemp('build');
      step(sh, 'BUILD_FAILED', product.buildCommand.replaceAll('{out}', pagesDir), product.repoPath);
    } else {
      pagesDir = path.join(product.repoPath, product.sourceDir);
    }

    const cloneDir = mkTemp('clone');
    step(sh, 'CLONE_FAILED', `git clone --quiet "${product.remote}" "${cloneDir}"`, os.tmpdir());
    stageMirror({ sourceDir: pagesDir, cloneDir, homeFrom: product.homeFrom });

    const foreign = findForeignSidebarLinks(cloneDir);
    if (foreign.length) throw new Error(`SIDEBAR_FOREIGN_LINKS: ${foreign.join(', ')}`);

    result.pages = countPages(cloneDir);
    sh(`${GIT} add -A`, cloneDir);
    const names = (filter) => sh(`${GIT} -c core.quotePath=false diff --cached --name-only${filter}`, cloneDir).split('\n').filter(Boolean);
    result.changed = names('');
    result.deleted = names(' --diff-filter=D');

    if (result.changed.length === 0) {
      result.status = 'UP_TO_DATE';
    } else if (dryRun) {
      return { ...result, status: 'DRY_RUN' };
    } else {
      step(sh, 'COMMIT_FAILED', `${GIT} commit --quiet -m "docs(wiki): sync ${product.name}"`, cloneDir);
      step(sh, 'PUSH_FAILED', `${GIT} push --quiet origin HEAD`, cloneDir);
      result.status = 'SYNCHRONIZED';
    }
    result.remoteHead = sh('git rev-parse HEAD', cloneDir);
    if (!dryRun && onPublished) await onPublished(cloneDir);
    return result;
  } catch (err) {
    return { ...result, status: 'FAILED', error: err.message };
  } finally {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

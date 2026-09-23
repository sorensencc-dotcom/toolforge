const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function expandHome(value) {
  if (typeof value !== 'string') return value;
  if (value === '~') return os.homedir();
  if (/^~[\\/]/.test(value)) return path.join(os.homedir(), value.slice(2));
  if (value.startsWith('~')) { const e = new Error('Unsupported ~username syntax'); e.code = 'ERR_VAULT_NOT_FOUND'; throw e; }
  return value;
}
function nearestRepo(start) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir); if (parent === dir) return null; dir = parent;
  }
}
function valid(candidate) {
  try { return fs.statSync(candidate).isDirectory() && (fs.existsSync(path.join(candidate, 'Index.md')) || fs.existsSync(path.join(candidate, 'Log.md'))); } catch { return false; }
}
function resolveVaultRoot(options = {}) {
  const env = options.env || process.env;
  const candidates = [];
  if (env.OBSIDIAN_VAULT_ROOT) {
    let p = path.resolve(expandHome(env.OBSIDIAN_VAULT_ROOT));
    if (path.basename(p).toLowerCase() !== 'wiki' && valid(path.join(p, 'wiki'))) p = path.join(p, 'wiki');
    candidates.push(p);
  }
  const repo = nearestRepo(options.cwd || process.cwd());
  if (repo) candidates.push(path.join(repo, 'kb-sync', 'obsidian', 'vault', 'wiki'), path.join(path.dirname(repo), 'kb-sync', 'obsidian', 'vault', 'wiki'));
  candidates.push(path.join(env.SystemDrive || (process.platform === 'win32' ? 'C:' : os.homedir()), 'dev', 'kb-sync', 'obsidian', 'vault', 'wiki'));
  const found = candidates.find(valid);
  if (!found) { const e = new Error('Canonical Obsidian vault not found or missing Index.md/Log.md'); e.code = 'ERR_VAULT_NOT_FOUND'; throw e; }
  return path.resolve(found);
}
module.exports = { expandHome, nearestRepo, resolveVaultRoot, valid };

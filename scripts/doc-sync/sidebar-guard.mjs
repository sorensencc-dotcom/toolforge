// scripts/doc-sync/sidebar-guard.mjs
import fs from 'node:fs';
import path from 'node:path';

// GitHub wikis resolve [[Page Name]] to Page-Name.md.
const pageKey = (name) => name.toLowerCase().replace(/ /g, '-');

function decode(t) {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

function inventory(dir) {
  const pages = new Set();
  const files = new Set();
  for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || path.join(e.parentPath ?? e.path, e.name).split(path.sep).includes('.git')) continue;
    const name = e.name.toLowerCase();
    files.add(name);
    if (name.endsWith('.md')) pages.add(pageKey(e.name.slice(0, -3)));
  }
  return { pages, files };
}

function targets(sidebar) {
  const out = [];
  for (const m of sidebar.matchAll(/\[\[([^\]]+)\]\]/g)) out.push(m[1].split('|').pop().trim());
  for (const m of sidebar.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) out.push(m[1].trim());
  return out
    .filter((t) => t && !t.startsWith('#') && !/^(https?|mailto):/i.test(t))
    .map((t) => decode(t.split('#')[0].split('/').pop()));
}

export function findForeignSidebarLinks(dir) {
  const file = path.join(dir, '_Sidebar.md');
  if (!fs.existsSync(file)) return [];
  const { pages, files } = inventory(dir);
  return [...new Set(targets(fs.readFileSync(file, 'utf8')))]
    .filter((t) => !files.has(t.toLowerCase()) && !pages.has(pageKey(t.replace(/\.md$/i, ''))))
    .map((t) => t.replace(/\.md$/i, ''));
}

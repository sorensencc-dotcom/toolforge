// scripts/doc-sync/sidebar-guard.mjs
import fs from 'node:fs';
import path from 'node:path';

function pageNames(dir) {
  const names = new Set();
  for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.md')) names.add(e.name.slice(0, -3).toLowerCase());
  }
  return names;
}

function targets(sidebar) {
  const out = [];
  for (const m of sidebar.matchAll(/\[\[([^\]]+)\]\]/g)) out.push(m[1].split('|').pop().trim());
  for (const m of sidebar.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) out.push(m[1].trim());
  return out
    .filter((t) => t && !t.startsWith('#') && !/^(https?|mailto):/i.test(t))
    .map((t) => t.split('#')[0].split('/').pop().replace(/\.md$/i, ''));
}

export function findForeignSidebarLinks(dir) {
  const file = path.join(dir, '_Sidebar.md');
  if (!fs.existsSync(file)) return [];
  const pages = pageNames(dir);
  return [...new Set(targets(fs.readFileSync(file, 'utf8')))].filter((t) => !pages.has(t.toLowerCase()));
}

import { readdir, open, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { PROJECTS, STATUSES, replaceDocument } from './store.mjs';
import { createWriterClient, createEmbeddingProvider } from './config.mjs';

export function parseResearchMarkdown(raw, relativePath, projectFilter) {
  if (typeof raw !== 'string' || typeof relativePath !== 'string' || !relativePath ||
      path.posix.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').includes('..') || /^[A-Za-z]:/.test(relativePath)) throw new Error('Invalid research path');
  if (projectFilter !== null && !PROJECTS.includes(projectFilter)) throw new Error('Invalid project filter');
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  let fm = {};
  let content = text;
  if (text.startsWith('---\n')) {
    const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
    if (!match) throw new Error('Invalid frontmatter');
    fm = yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) ?? {};
    content = match[2];
  }
  if (typeof fm !== 'object' || Array.isArray(fm)) throw new Error('Frontmatter must be a mapping');
  const project = fm.project ?? projectFilter ?? 'CIC';
  const status = fm.status ?? 'UNKNOWN';
  if (!PROJECTS.includes(project) || !STATUSES.includes(status)) throw new Error('Invalid project or status');
  if (fm.confidence != null && (typeof fm.confidence !== 'number' || !Number.isFinite(fm.confidence) || fm.confidence < 0 || fm.confidence > 1)) throw new Error('Invalid confidence');
  for (const key of ['title', 'source_uri', 'source_type', 'source_system', 'drive_file_id']) {
    if (fm[key] != null && (typeof fm[key] !== 'string' || !fm[key].trim())) throw new Error(`Invalid ${key}`);
  }
  if (fm.source_system != null && !['git', 'drive'].includes(fm.source_system)) throw new Error('Invalid source_system');
  if (fm.metadata != null && (typeof fm.metadata !== 'object' || Array.isArray(fm.metadata))) throw new Error('Invalid metadata');
  if (fm.tags != null && (!Array.isArray(fm.tags) || fm.tags.some(tag => typeof tag !== 'string'))) throw new Error('Invalid tags');
  if (projectFilter && project !== projectFilter) return null;
  content = content.trim();
  const chunks = content.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
  if (chunks.some(chunk => chunk.length > 8000)) throw new Error('Paragraph exceeds 8000 characters; split source paragraph');
  return { document: {
    project, title: fm.title ?? path.posix.basename(relativePath, path.posix.extname(relativePath)),
    source_uri: fm.source_uri ?? null, source_type: fm.source_type ?? (project === 'RewriteLabs' ? 'trend_brief' : 'archive'),
    source_system: fm.source_system ?? (fm.drive_file_id ? 'drive' : 'git'), git_path: relativePath,
    drive_file_id: fm.drive_file_id ?? null, content_hash: createHash('sha256').update(content).digest('hex'),
    metadata: { ...fm.metadata, tags: fm.tags ?? [], status, confidence: fm.confidence ?? null },
  }, chunks };
}

export async function syncResearch({ root, project = null, dryRun = false }, { supabase, embed } = {}) {
  if (project !== null && !PROJECTS.includes(project)) throw new Error('Invalid project filter');
  const directory = await realpath(root);
  const result = { processed: 0, skipped: 0, failed: 0 };
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) { result.skipped++; continue; }
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!entry.isFile() || !/\.(md|markdown)$/i.test(entry.name)) continue;
      try {
        const resolved = await realpath(file);
        const relativePath = path.relative(directory, resolved);
        if (relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) throw new Error('Research path escapes root');
        const expected = await stat(resolved);
        const handle = await open(resolved, 'r');
        let raw;
        try {
          const opened = await handle.stat();
          if (opened.dev !== expected.dev || opened.ino !== expected.ino || await realpath(resolved) !== resolved) throw new Error('Research file changed during open');
          raw = await handle.readFile('utf8');
          const after = await handle.stat();
          if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || await realpath(resolved) !== resolved) throw new Error('Research file changed during read');
        } finally { await handle.close(); }
        const parsed = parseResearchMarkdown(raw, relativePath.split(path.sep).join('/'), project);
        if (!parsed) { result.skipped++; continue; }
        if (!dryRun) await replaceDocument(supabase, parsed.document, parsed.chunks, embed);
        result.processed++;
      } catch { result.failed++; }
    }
  }
  await walk(directory);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  let project = null;
  let dryRun = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--dry-run') dryRun = true;
    else if (args[index] === '--project' && PROJECTS.includes(args[index + 1])) project = args[++index];
    else throw new Error('Invalid arguments or project');
  }
  const root = process.env.RESEARCH_ROOT;
  if (!root) throw new Error('RESEARCH_ROOT required');
  const dependencies = dryRun ? {} : { embed: createEmbeddingProvider(process.env), supabase: createWriterClient(process.env) };
  const result = await syncResearch({ root, project, dryRun }, dependencies);
  console.error(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

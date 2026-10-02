// scripts/doc-sync/registry.mjs
import fs from 'node:fs';
import path from 'node:path';

const REMOTE_RE = /^(?:https:\/\/github\.com\/|git@github\.com:)sorensencc-dotcom\/([\w.-]+)\.wiki\.git$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const DISALLOWED = ['_kb-sync-staging', 'dev-sandbox', '.claude', 'node_modules'];
const QUARANTINE_ROOT = 'c:\\dev\\wiki';
const OPTIONAL_STRINGS = ['sourceDir', 'buildCommand', 'homeFrom', 'preValidate'];

function fail(msg) {
  throw new Error(`REGISTRY_INVALID: ${msg}`);
}

const parts = (p) => p.toLowerCase().split(/[\\/]+/).filter(Boolean);
const hasDisallowedPart = (p) => {
  const segs = parts(p);
  return segs.includes('..') || DISALLOWED.some((d) => {
    const want = d.split('/');
    return segs.some((_, i) => want.every((w, j) => segs[i + j] === w));
  });
};

function checkRepoPath(p) {
  if (!path.win32.isAbsolute(p.repoPath)) fail(`${p.name}: repoPath must be absolute`);
  if (hasDisallowedPart(p.repoPath)) fail(`${p.name}: repoPath ${p.repoPath} is inside a disallowed folder`);
}

function checkSourceDir(p) {
  const src = p.sourceDir;
  if (path.win32.isAbsolute(src) || path.posix.isAbsolute(src)) fail(`sourceDir ${src} must be relative (${p.name})`);
  if (hasDisallowedPart(src)) fail(`sourceDir ${src} is disallowed (${p.name})`);
  const root = path.win32.resolve(p.repoPath).toLowerCase();
  const abs = path.win32.resolve(p.repoPath, src).toLowerCase();
  if (abs === root || !abs.startsWith(root + '\\')) fail(`sourceDir ${src} must be a folder inside repoPath (${p.name})`);
  if (abs === QUARANTINE_ROOT || abs.startsWith(QUARANTINE_ROOT + '\\')) fail(`sourceDir ${abs} is the quarantine dump (${p.name})`);
}

export function validateRegistry(raw) {
  if (!raw || !Array.isArray(raw.products)) fail('missing products array');
  const names = new Set();
  const remotes = new Set();
  return raw.products.map((p, i) => {
    if (!p || typeof p !== 'object') fail(`row ${i} is not an object`);
    for (const k of ['name', 'repoPath', 'remote']) if (typeof p[k] !== 'string' || !p[k]) fail(`row ${i}: missing ${k}`);
    for (const k of OPTIONAL_STRINGS) if (p[k] !== undefined && typeof p[k] !== 'string') fail(`${p.name}: ${k} must be a string`);
    if (!NAME_RE.test(p.name)) fail(`name ${JSON.stringify(p.name)} must match ${NAME_RE}`);
    if (typeof p.enabled !== 'boolean') fail(`${p.name}: enabled must be boolean`);
    if (p.ingest !== undefined && typeof p.ingest !== 'boolean') fail(`${p.name}: ingest must be boolean`);
    const m = REMOTE_RE.exec(p.remote);
    if (!m) fail(`remote ${p.remote} is not a sorensencc-dotcom wiki (${p.name})`);
    checkRepoPath(p);
    if (Boolean(p.sourceDir) === Boolean(p.buildCommand)) fail(`${p.name}: set exactly one of sourceDir or buildCommand`);
    if (p.buildCommand && !p.buildCommand.includes('{out}')) fail(`${p.name}: buildCommand must contain {out}`);
    if (p.sourceDir) checkSourceDir(p);
    const remoteKey = m[1].toLowerCase();
    if (names.has(p.name)) fail(`duplicate name ${p.name}`);
    if (remotes.has(remoteKey)) fail(`duplicate remote ${p.remote}`);
    names.add(p.name);
    remotes.add(remoteKey);
    return { ...p, ingest: p.ingest ?? true };
  });
}

export function loadRegistry(filePath) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`cannot read ${filePath}: ${err.message}`);
  }
  return validateRegistry(raw);
}

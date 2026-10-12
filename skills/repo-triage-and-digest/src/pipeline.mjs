import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEFAULT_EXCLUDE = 'tests/*,docs/*,node_modules/*,vendor/*,dist/*,*.lock,package-lock.json,*.bin,*.min.js';
export const DEFAULT_MAX_FILE_SIZE_KB = 50;

const GITHUB_REPO = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'vendor', 'coverage']);

export function normalizeGithubUrl(input) {
  let url = String(input || '').trim();
  if (!url) throw Object.assign(new Error('repository URL is required'), { code: 'INVALID_REPOSITORY' });
  url = url.replace(/\.git$/, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://github.com/${url.replace(/^\/+/, '')}`;
  }
  url = url.replace(/^http:\/\//i, 'https://');
  const match = url.match(GITHUB_REPO);
  if (!match) throw Object.assign(new Error('repository URL must be a github.com owner/repo path'), { code: 'INVALID_REPOSITORY' });
  return `https://github.com/${match[1]}/${match[2]}`;
}

export function repositorySlug(repositoryUrl) {
  const match = normalizeGithubUrl(repositoryUrl).match(GITHUB_REPO);
  return `${match[1]}/${match[2]}`;
}

export function splitPatterns(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map((item) => String(item).trim()).filter(Boolean);
}

function patternsAreAnchored(patterns) {
  return patterns.length > 0 && patterns.every((pattern) => {
    const pat = pattern.replaceAll('\\', '/');
    return pat.includes('/') && !pat.startsWith('*');
  });
}

function directoryCanMatchInclude(relativeDir, patterns) {
  const rel = relativeDir.replaceAll('\\', '/');
  return patterns.some((pattern) => {
    const pat = pattern.replaceAll('\\', '/');
    const prefix = pat.endsWith('/*') ? pat.slice(0, -2) : pat.slice(0, pat.lastIndexOf('/'));
    return rel === prefix || prefix.startsWith(`${rel}/`) || rel.startsWith(`${prefix}/`);
  });
}

function excludeWantsDirectory(relativeDir, exclude) {
  const rel = relativeDir.replaceAll('\\', '/');
  return exclude.some((pattern) => {
    const pat = pattern.replaceAll('\\', '/');
    if (!pat.endsWith('/*')) return false;
    const prefix = pat.slice(0, -2);
    return rel === prefix || rel.startsWith(`${prefix}/`) || rel.endsWith(`/${prefix}`) || rel.includes(`/${prefix}/`);
  });
}

function matchPattern(relativePath, pattern) {
  const rel = relativePath.replaceAll('\\', '/');
  const pat = pattern.replaceAll('\\', '/');
  const base = rel.split('/').pop();
  if (pat.endsWith('/*')) {
    const prefix = pat.slice(0, -2);
    return rel === prefix || rel.startsWith(`${prefix}/`);
  }
  if (pat.startsWith('*.')) return base.endsWith(pat.slice(1));
  if (pat.includes('*')) {
    const expression = `^${pat.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`;
    return new RegExp(expression).test(rel) || new RegExp(expression).test(base);
  }
  return rel === pat || base === pat || rel.startsWith(`${pat}/`);
}

export function gitdiagramTriage(repositoryUrl) {
  const clean = normalizeGithubUrl(repositoryUrl);
  const slug = repositorySlug(clean);
  return {
    repositoryUrl: clean,
    interactiveDiagramUrl: `https://gitdiagram.com/${slug}`,
    explainerVideoUrl: `https://gitdiagram.com/${slug}/videos`,
    instructions: 'Inspect component boundaries, then pass only those directories to gitingest_digest.'
  };
}

export function gitingestUrl(repositoryUrl, options = {}) {
  const slug = repositorySlug(repositoryUrl);
  const params = new URLSearchParams();
  if (options.includePatterns) params.set('include', String(options.includePatterns));
  params.set('exclude', String(options.excludePatterns || DEFAULT_EXCLUDE));
  params.set('max_size', String(options.maxFileSizeKb ?? DEFAULT_MAX_FILE_SIZE_KB));
  return `https://gitingest.com/${slug}?${params.toString()}`;
}

function renderTree(rootName, relativePaths) {
  const root = { dirs: new Map(), files: [] };
  for (const relativePath of relativePaths) {
    const parts = relativePath.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push(parts.at(-1));
  }
  const lines = [`${rootName}/`];
  const walk = (node, indent) => {
    for (const [name, child] of node.dirs) {
      lines.push(`${indent}${name}/`);
      walk(child, `${indent}  `);
    }
    for (const file of node.files) lines.push(`${indent}${file}`);
  };
  walk(root, '  ');
  return lines.join('\n');
}

export function digestLocalTree(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const include = splitPatterns(options.includePatterns);
  const exclude = splitPatterns(options.excludePatterns ?? DEFAULT_EXCLUDE);
  const maxBytes = (options.maxFileSizeKb ?? DEFAULT_MAX_FILE_SIZE_KB) * 1024;
  const included = [];
  const pruned = [];

  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) {
          pruned.push({ path: relative, reason: 'skipped directory' });
          continue;
        }
        if (patternsAreAnchored(include) && !excludeWantsDirectory(relative, exclude) && !directoryCanMatchInclude(relative, include)) {
          pruned.push({ path: relative, reason: 'outside include' });
          continue;
        }
        walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const excluded = exclude.find((pattern) => matchPattern(relative, pattern));
      if (excluded) {
        pruned.push({ path: relative, reason: excluded });
        continue;
      }
      if (include.length > 0 && !include.some((pattern) => matchPattern(relative, pattern))) {
        pruned.push({ path: relative, reason: 'outside include' });
        continue;
      }
      const size = fs.statSync(absolute).size;
      if (size > maxBytes) {
        pruned.push({ path: relative, reason: 'size' });
        continue;
      }
      included.push({ path: relative, content: fs.readFileSync(absolute, 'utf8') });
    }
  };

  walk(root);
  included.sort((left, right) => left.path.localeCompare(right.path));
  const rootName = path.basename(root);
  const tree = renderTree(rootName, included.map((file) => file.path));
  const body = included.map((file) => [
    '================================================',
    `File: ${file.path}`,
    '================================================',
    file.content.trimEnd()
  ].join('\n')).join('\n\n');
  return {
    summary: `${included.length} files extracted | ${pruned.length} files pruned from context`,
    directoryTree: tree,
    files: included,
    pruned,
    content: `${tree}\n\n${body}`.trim()
  };
}

function envelope(tool, data, startedAt, extra = {}) {
  return {
    executionId: randomUUID(),
    tool,
    version: '1.0.0',
    status: 'success',
    latencyMs: Date.now() - startedAt,
    retryCount: 0,
    data,
    telemetry: {
      timestamp: new Date().toISOString(),
      capabilitiesVerified: extra.capabilities || [],
      sandboxIsolation: 'in-memory',
      tokenPruned: extra.tokenPruned
    }
  };
}

export function gitingestDigest(input) {
  const startedAt = Date.now();
  const repositoryUrl = normalizeGithubUrl(input.repositoryUrl || input.repoUrl);
  const authUsed = Boolean(input.authToken);
  const excludePatterns = input.excludePatterns || DEFAULT_EXCLUDE;
  const maxFileSizeKb = Number(input.maxFileSizeKb ?? DEFAULT_MAX_FILE_SIZE_KB);
  const local = input.localRoot
    ? digestLocalTree(input.localRoot, {
      includePatterns: input.includePatterns,
      excludePatterns,
      maxFileSizeKb
    })
    : null;
  return envelope('gitingest_digest', {
    repositoryUrl,
    ingestUrl: gitingestUrl(repositoryUrl, { includePatterns: input.includePatterns, excludePatterns, maxFileSizeKb }),
    includePatterns: input.includePatterns || null,
    excludePatterns,
    maxFileSizeKb,
    summary: local?.summary || null,
    directoryTree: local?.directoryTree || null,
    content: local?.content || null,
    pruned: local?.pruned || [],
    security: { authMemoryOnly: authUsed, credentialsDiscarded: true }
  }, startedAt, {
    capabilities: ['repo:read', 'repo:ingest'],
    tokenPruned: Boolean(input.includePatterns || excludePatterns)
  });
}

export function triageAndDigest(input) {
  const startedAt = Date.now();
  const repositoryUrl = normalizeGithubUrl(input.repositoryUrl || input.repoUrl);
  const triage = gitdiagramTriage(repositoryUrl);
  const includePatterns = input.includePatterns
    || (Array.isArray(input.targetModules) ? input.targetModules.join(',') : input.targetModules);
  const digest = gitingestDigest({ ...input, repositoryUrl, includePatterns, authToken: input.authToken });
  return envelope('triage_and_digest', {
    pipeline: 'GitDiagram-to-Gitingest',
    repository: repositoryUrl,
    visualArchitecture: triage,
    ingestionDigest: digest.data
  }, startedAt, {
    capabilities: ['repo:read', 'repo:visualize', 'repo:ingest'],
    tokenPruned: digest.telemetry.tokenPruned
  });
}

export const TOOLS = [
  {
    name: 'gitdiagram_triage',
    description: 'Stage 1: Build GitDiagram architecture and explainer links for a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryUrl: { type: 'string' },
        mode: { type: 'string', enum: ['diagram', 'video'], default: 'diagram' }
      },
      required: ['repositoryUrl']
    }
  },
  {
    name: 'gitingest_digest',
    description: 'Stage 2: Build a size-capped Gitingest digest. Pass localRoot to extract files on disk.',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryUrl: { type: 'string' },
        includePatterns: { type: 'string' },
        excludePatterns: { type: 'string' },
        maxFileSizeKb: { type: 'number', default: 50 },
        localRoot: { type: 'string' },
        authToken: { type: 'string' }
      },
      required: ['repositoryUrl']
    }
  },
  {
    name: 'triage_and_digest',
    description: 'Run GitDiagram triage, then a scoped Gitingest digest.',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryUrl: { type: 'string' },
        targetModules: { type: 'array', items: { type: 'string' } },
        localRoot: { type: 'string' },
        maxFileSizeKb: { type: 'number', default: 50 }
      },
      required: ['repositoryUrl']
    }
  }
];

export function callTool(name, args = {}) {
  const startedAt = Date.now();
  if (name === 'gitdiagram_triage') {
    const triage = gitdiagramTriage(args.repositoryUrl);
    const mode = args.mode === 'video' ? 'video' : 'diagram';
    return envelope(name, { ...triage, mode, selectedUrl: mode === 'video' ? triage.explainerVideoUrl : triage.interactiveDiagramUrl }, startedAt, {
      capabilities: ['repo:read', 'repo:visualize']
    });
  }
  if (name === 'gitingest_digest') return gitingestDigest(args);
  if (name === 'triage_and_digest') return triageAndDigest(args);
  throw Object.assign(new Error(`Tool '${name}' is not in the KB-Skills registry`), { code: 'UNKNOWN_TOOL' });
}

export function handleMcpMessage(message) {
  const id = message?.id ?? null;
  const method = message?.method;
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return null;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'repo-triage-and-digest', version: '1.0.0' }
      }
    };
  }
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    try {
      const result = callTool(message.params?.name, message.params?.arguments || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: { code: error.code || 'EXECUTION_FAILURE', message: error.message } }) }]
        }
      };
    }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

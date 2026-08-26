const DIFF_STATUSES = new Set(['added', 'copied', 'deleted', 'modified', 'renamed', 'untracked']);

export class DiffEntryError extends TypeError {
  constructor() {
    super('Invalid delivery-guard diff entry');
    this.name = 'DiffEntryError';
  }
}

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function globToRegExp(glob) {
  const normalized = normalizePath(glob);
  let expression = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*' && normalized[index + 1] === '*') {
      if (normalized[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += ('\\^$.*+?()[]{}|'.includes(character) ? `\\${character}` : character);
    }
  }

  return new RegExp(`^${expression}$`);
}

function matchesGeneratedPath(path, generatedGlobs) {
  return generatedGlobs.some((glob) => globToRegExp(glob).test(path));
}

function normalizeEntry(entry) {
  if (typeof entry === 'string') {
    return { path: normalizePath(entry), status: 'untracked' };
  }

  if (entry === null || typeof entry !== 'object'
    || typeof entry.path !== 'string'
    || entry.path.trim().length === 0
    || (entry.status !== undefined && !DIFF_STATUSES.has(entry.status))) {
    throw new DiffEntryError();
  }

  const normalized = {
    path: normalizePath(entry.path),
    status: entry.status ?? 'modified',
  };
  if (entry.oldPath !== undefined) {
    if (typeof entry.oldPath !== 'string' || entry.oldPath.trim().length === 0) {
      throw new DiffEntryError();
    }
    normalized.oldPath = normalizePath(entry.oldPath);
  }
  return normalized;
}

function classifyPath(path, generatedGlobs) {
  return matchesGeneratedPath(path, generatedGlobs) ? 'generated' : 'authored';
}

export function classifyDiff(entries, adapter, options = {}) {
  if (!Array.isArray(entries) || adapter === null || typeof adapter !== 'object'
    || !Array.isArray(adapter.generatedPaths)) {
    throw new TypeError('Invalid delivery-guard classifier input');
  }

  const normalizedEntries = entries.map(normalizeEntry);
  const authoredPaths = new Set();
  const generatedPaths = new Set();

  for (const entry of normalizedEntries) {
    for (const path of [entry.oldPath, entry.path].filter(Boolean)) {
      if (classifyPath(path, adapter.generatedPaths) === 'generated') {
        generatedPaths.add(path);
      } else {
        authoredPaths.add(path);
      }
    }
  }

  const authored = [...authoredPaths].sort();
  const generated = [...generatedPaths].sort();
  const paths = [...new Set([...authored, ...generated])].sort();
  const classification = authored.length > 0 && generated.length > 0
    ? 'mixed'
    : generated.length > 0
      ? 'generated-only'
      : authored.length > 0
        ? 'authored-only'
        : 'none';

  let decision = 'allow';
  let issues = [];
  if (classification === 'generated-only' && options.generatedIntent !== true) {
    decision = 'block';
    issues = ['generated-intent-required'];
  } else if (classification === 'mixed') {
    decision = 'warn';
    issues = ['mixed-authored-generated'];
  }

  return {
    classification,
    decision,
    issues,
    generatedIntent: options.generatedIntent === true ? 'explicit' : 'missing',
    paths,
    authoredPaths: authored,
    generatedPaths: generated,
  };
}

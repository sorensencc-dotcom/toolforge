import fs from 'node:fs';
import path from 'node:path';

export class ManifestError extends TypeError {
  constructor(message, issues = []) {
    super(message);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRepoEntry(entry, index, baseDir) {
  if (!isPlainObject(entry)) {
    throw new ManifestError(`Invalid repository entry at index ${index}: must be an object`);
  }

  if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
    throw new ManifestError(`Invalid repository entry at index ${index}: missing or empty 'id'`);
  }

  const rawPath = typeof entry.path === 'string' && entry.path.trim().length > 0 ? entry.path : '.';
  const resolvedPath = path.isAbsolute(rawPath) ? path.normalize(rawPath) : path.resolve(baseDir, rawPath);

  const pushArgs = Array.isArray(entry.pushArgs)
    ? entry.pushArgs.map((arg) => String(arg))
    : [];

  return {
    id: entry.id.trim(),
    path: resolvedPath,
    pushArgs,
  };
}

export function parsePushManifest(manifestInput, options = {}) {
  const defaultRepoRoot = options.defaultRepoRoot ? path.resolve(options.defaultRepoRoot) : process.cwd();

  if (manifestInput === undefined || manifestInput === null) {
    return {
      version: 1,
      source: 'default',
      repositories: [
        {
          id: options.defaultRepoId || path.basename(defaultRepoRoot),
          path: defaultRepoRoot,
          pushArgs: options.defaultPushArgs || [],
        },
      ],
    };
  }

  let raw = manifestInput;
  let baseDir = defaultRepoRoot;

  if (typeof manifestInput === 'string') {
    const manifestPath = path.resolve(defaultRepoRoot, manifestInput);
    if (!fs.existsSync(manifestPath)) {
      throw new ManifestError(`Manifest file not found: ${manifestPath}`);
    }
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      baseDir = path.dirname(manifestPath);
    } catch (err) {
      throw new ManifestError(`Failed to parse manifest JSON: ${err.message}`);
    }
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new ManifestError('Manifest repository list cannot be empty');
    }
    return {
      version: 1,
      source: typeof manifestInput === 'string' ? 'file' : 'object',
      repositories: raw.map((entry, index) => normalizeRepoEntry(entry, index, baseDir)),
    };
  }

  if (isPlainObject(raw)) {
    if (raw.version !== undefined && raw.version !== 1) {
      throw new ManifestError(`Unsupported manifest version: ${raw.version}`);
    }
    if (!Array.isArray(raw.repositories) || raw.repositories.length === 0) {
      throw new ManifestError("Manifest object must contain a non-empty 'repositories' array");
    }
    return {
      version: 1,
      source: typeof manifestInput === 'string' ? 'file' : 'object',
      repositories: raw.repositories.map((entry, index) => normalizeRepoEntry(entry, index, baseDir)),
    };
  }

  throw new ManifestError('Invalid manifest input: must be a file path, object, or array');
}

// SemVer Version Pin Resolver
// Resolves version constraints: ^1.2.0, ~1.2.0, 1.2.0, >=1.2.0, etc.

export class SemVerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SemVerError';
  }
}

export function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.*?))?(?:\+(.*))?$/);
  if (!match) {
    throw new SemVerError(`Invalid version format: ${version}`);
  }
  const [, major, minor, patch, prerelease, metadata] = match;
  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease || null,
    metadata: metadata || null,
  };
}

export function compareVersions(v1, v2) {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);

  if (parsed1.major !== parsed2.major) return parsed1.major > parsed2.major ? 1 : -1;
  if (parsed1.minor !== parsed2.minor) return parsed1.minor > parsed2.minor ? 1 : -1;
  if (parsed1.patch !== parsed2.patch) return parsed1.patch > parsed2.patch ? 1 : -1;

  // Prerelease comparison: no prerelease > prerelease
  if (parsed1.prerelease && !parsed2.prerelease) return -1;
  if (!parsed1.prerelease && parsed2.prerelease) return 1;
  if (parsed1.prerelease && parsed2.prerelease) {
    return parsed1.prerelease.localeCompare(parsed2.prerelease);
  }

  return 0;
}

export function resolvePin(constraint, availableVersions) {
  // Supported constraints:
  // ^1.2.0 — >=1.2.0 <2.0.0
  // ~1.2.0 — >=1.2.0 <1.3.0
  // 1.2.0 — exact match
  // >=1.2.0 — greater or equal
  // <=1.2.0 — less or equal
  // >1.2.0 — greater
  // <1.2.0 — less
  // 1.2.* — any patch version

  const caretMatch = constraint.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
  if (caretMatch) {
    const [, major, minor, patch] = caretMatch;
    const lower = `${major}.${minor}.${patch}`;
    const upper = `${parseInt(major) + 1}.0.0`;
    return findBestVersion(availableVersions, v => {
      return compareVersions(v, lower) >= 0 && compareVersions(v, upper) < 0;
    });
  }

  const tildeMatch = constraint.match(/^~(\d+)\.(\d+)\.(\d+)$/);
  if (tildeMatch) {
    const [, major, minor, patch] = tildeMatch;
    const lower = `${major}.${minor}.${patch}`;
    const upper = `${major}.${parseInt(minor) + 1}.0`;
    return findBestVersion(availableVersions, v => {
      return compareVersions(v, lower) >= 0 && compareVersions(v, upper) < 0;
    });
  }

  const exactMatch = constraint.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (exactMatch) {
    return availableVersions.find(v => v === constraint) || null;
  }

  const gteMatch = constraint.match(/^>=(\d+)\.(\d+)\.(\d+)$/);
  if (gteMatch) {
    const lower = gteMatch[1] + '.' + gteMatch[2] + '.' + gteMatch[3];
    return findBestVersion(availableVersions, v => compareVersions(v, lower) >= 0);
  }

  const lteMatch = constraint.match(/^<=(\d+)\.(\d+)\.(\d+)$/);
  if (lteMatch) {
    const upper = lteMatch[1] + '.' + lteMatch[2] + '.' + lteMatch[3];
    return findBestVersion(availableVersions, v => compareVersions(v, upper) <= 0);
  }

  const gtMatch = constraint.match(/^>(\d+)\.(\d+)\.(\d+)$/);
  if (gtMatch) {
    const lower = gtMatch[1] + '.' + gtMatch[2] + '.' + gtMatch[3];
    return findBestVersion(availableVersions, v => compareVersions(v, lower) > 0);
  }

  const ltMatch = constraint.match(/^<(\d+)\.(\d+)\.(\d+)$/);
  if (ltMatch) {
    const upper = ltMatch[1] + '.' + ltMatch[2] + '.' + ltMatch[3];
    return findBestVersion(availableVersions, v => compareVersions(v, upper) < 0);
  }

  const wildcardMatch = constraint.match(/^(\d+)\.(\d+)\.\*$/);
  if (wildcardMatch) {
    const major = wildcardMatch[1];
    const minor = wildcardMatch[2];
    return findBestVersion(availableVersions, v => {
      const parsed = parseVersion(v);
      return parsed.major === parseInt(major) && parsed.minor === parseInt(minor);
    });
  }

  throw new SemVerError(`Unsupported version constraint: ${constraint}`);
}

function findBestVersion(versions, predicate) {
  const matching = versions.filter(v => {
    try {
      return predicate(v);
    } catch {
      return false;
    }
  });

  if (matching.length === 0) {
    return null;
  }

  matching.sort((a, b) => compareVersions(b, a));
  return matching[0];
}

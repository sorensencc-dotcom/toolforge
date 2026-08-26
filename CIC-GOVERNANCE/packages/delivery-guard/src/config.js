const PATH_FIELDS = ['generatedPaths', 'automationPaths'];

export class AdapterConfigError extends Error {
  constructor(issues) {
    super(`Invalid delivery-guard adapter configuration (${issues.length} issue(s))`);
    this.name = 'AdapterConfigError';
    this.issues = issues;
  }
}

function addIssue(issues, path, message) {
  issues.push({ path, message });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRelativePath(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && !value.startsWith('/')
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !/(^|[\\/])\.\.([\\/]|$)/.test(value);
}

function validatePathList(config, field, issues) {
  const paths = config[field];
  if (!Array.isArray(paths) || paths.length === 0) {
    addIssue(issues, field, 'must be a non-empty array of relative glob patterns');
    return;
  }

  paths.forEach((value, index) => {
    if (!validateRelativePath(value)) {
      addIssue(issues, field, `item ${index} must be a relative glob pattern without parent traversal`);
    }
  });
}

function validateStringList(config, field, issues) {
  const values = config[field];
  if (!Array.isArray(values) || values.length === 0) {
    addIssue(issues, field, 'must be a non-empty array of commands');
    return;
  }

  values.forEach((value, index) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      addIssue(issues, field, `item ${index} must be a non-empty command`);
    }
  });
}

export function validateAdapterConfig(config) {
  const issues = [];

  if (!isPlainObject(config)) {
    throw new AdapterConfigError([{ path: '', message: 'must be an object' }]);
  }

  const repository = config.repository;
  if (!isPlainObject(repository)) {
    addIssue(issues, 'repository', 'must be an object');
  } else {
    if (typeof repository.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(repository.id)) {
      addIssue(issues, 'repository.id', 'must be a kebab-case identifier');
    }
    if (!validateRelativePath(repository.root)) {
      addIssue(issues, 'repository.root', 'must be a relative path without parent traversal');
    }
  }

  PATH_FIELDS.forEach((field) => validatePathList(config, field, issues));
  validateStringList(config, 'testCommands', issues);

  const hookInstaller = config.hookInstaller;
  if (!isPlainObject(hookInstaller)) {
    addIssue(issues, 'hookInstaller', 'must be an object');
  } else {
    if (typeof hookInstaller.command !== 'string' || hookInstaller.command.trim().length === 0) {
      addIssue(issues, 'hookInstaller.command', 'must be a non-empty command');
    }
    if (!validateRelativePath(hookInstaller.installedPath)
      || !hookInstaller.installedPath.replaceAll('\\', '/').startsWith('.git/hooks/')) {
      addIssue(issues, 'hookInstaller.installedPath', 'must be a relative path under .git/hooks');
    }
  }

  if (issues.length > 0) {
    throw new AdapterConfigError(issues);
  }

  return config;
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Creates a hermetic, isolated temporary test sandbox directory using mkdtemp.
 *
 * @param {string} [prefix='toolforge-test-']
 * @returns {{
 *   dir: string,
 *   path: (...subPaths: string[]) => string,
 *   mkdir: (...subPaths: string[]) => string,
 *   writeFile: (subPath: string, content: string | Buffer, options?: any) => string,
 *   readFile: (subPath: string, encoding?: BufferEncoding) => string,
 *   cleanup: () => void,
 *   [Symbol.dispose]: () => void
 * }}
 */
export function createSandbox(prefix = 'toolforge-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  const resolvePath = (...subPaths) => path.join(dir, ...subPaths);

  const mkdir = (...subPaths) => {
    const target = resolvePath(...subPaths);
    fs.mkdirSync(target, { recursive: true });
    return target;
  };

  const writeFile = (subPath, content, options = 'utf8') => {
    const fullPath = resolvePath(subPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, options);
    return fullPath;
  };

  const readFile = (subPath, encoding = 'utf8') => {
    return fs.readFileSync(resolvePath(subPath), encoding);
  };

  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore transient cleanup errors on Windows
    }
  };

  return {
    dir,
    path: resolvePath,
    mkdir,
    writeFile,
    readFile,
    cleanup,
    [Symbol.dispose]() {
      cleanup();
    }
  };
}

/**
 * Runs a test block inside a disposable sandbox with guaranteed cleanup.
 *
 * @template T
 * @param {string|Function} prefix
 * @param {(sandbox: ReturnType<typeof createSandbox>) => Promise<T> | T} [fn]
 * @returns {Promise<T>}
 */
export async function withSandbox(prefix, fn) {
  let actualPrefix = prefix;
  let actualFn = fn;
  if (typeof prefix === 'function') {
    actualFn = prefix;
    actualPrefix = 'toolforge-test-';
  }
  const sandbox = createSandbox(actualPrefix);
  try {
    return await actualFn(sandbox);
  } finally {
    sandbox.cleanup();
  }
}

/**
 * Synchronously runs a test block inside a disposable sandbox with guaranteed cleanup.
 *
 * @template T
 * @param {string|Function} prefix
 * @param {(sandbox: ReturnType<typeof createSandbox>) => T} [fn]
 * @returns {T}
 */
export function withSandboxSync(prefix, fn) {
  let actualPrefix = prefix;
  let actualFn = fn;
  if (typeof prefix === 'function') {
    actualFn = prefix;
    actualPrefix = 'toolforge-test-';
  }
  const sandbox = createSandbox(actualPrefix);
  try {
    return actualFn(sandbox);
  } finally {
    sandbox.cleanup();
  }
}

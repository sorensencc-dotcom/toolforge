import test from 'node:test';
import assert from 'node:assert';
import { validateManifest, ManifestError } from './manifest.js';

test('Manifest Validator', async (t) => {
  await t.test('accept valid manifest', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A linting skill for code analysis',
      owner: 'user@example.com',
      entrypoint: 'src/index.js',
      runtime: 'node',
      status: 'published',
    };
    const result = validateManifest(manifest);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.manifest.name, 'my-skill');
  });

  await t.test('reject missing required fields', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('reject invalid name', () => {
    const manifest = {
      name: 'My-Skill', // uppercase not allowed
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('reject invalid version', () => {
    const manifest = {
      name: 'my-skill',
      version: 'v1.0.0', // v prefix not allowed
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('reject invalid category', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      category: 'invalid-category',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('reject short description', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'Short', // less than 10 chars
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('reject invalid email owner', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'not-an-email',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('reject invalid runtime', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'invalid-runtime',
    };
    assert.throws(
      () => validateManifest(manifest),
      ManifestError
    );
  });

  await t.test('default status to draft', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    const result = validateManifest(manifest);
    assert.strictEqual(result.manifest.status, 'draft');
  });

  await t.test('accept valid $schema URI (URL and URN)', () => {
    const manifestUrl = {
      $schema: 'https://json-schema.org/draft-07/schema',
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    const resultUrl = validateManifest(manifestUrl);
    assert.strictEqual(resultUrl.manifest.$schema, 'https://json-schema.org/draft-07/schema');

    const manifestUrn = {
      $schema: 'urn:toolforge:schema:base-sync-task:v1',
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    const resultUrn = validateManifest(manifestUrn);
    assert.strictEqual(resultUrn.manifest.$schema, 'urn:toolforge:schema:base-sync-task:v1');
  });

  await t.test('reject scrubbed or malformed $schema URI', () => {
    const scrubbedManifest = {
      $schema: '[Suspicious link removed]',
      name: 'my-skill',
      version: '1.0.0',
      category: 'linting',
      description: 'A skill for linting',
      owner: 'user@example.com',
      entrypoint: 'index.js',
      runtime: 'node',
    };
    assert.throws(
      () => validateManifest(scrubbedManifest),
      (err) => err instanceof ManifestError && err.message.includes('Field "$schema" must be a valid URI')
    );
  });
});

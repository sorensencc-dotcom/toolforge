import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function validateManifestPayload(manifest, schema) {
  const errors = [];
  if (manifest.manifestVersion !== '1.0.0') {
    errors.push('Unknown or unsupported manifestVersion');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Missing required root field: name');
  }
  if (!Array.isArray(manifest.skills)) {
    errors.push('Missing required root field: skills array');
    return { valid: false, errors };
  }

  for (const [idx, skill] of manifest.skills.entries()) {
    if (!skill.skillId) {
      errors.push(`Skill at index ${idx} missing required field: skillId`);
    }
    if (!skill.packageName) {
      errors.push(`Skill at index ${idx} missing required field: packageName`);
    }
    if (!skill.entry) {
      errors.push(`Skill at index ${idx} missing required field: entry`);
    }
    if (skill.permissions && skill.permissions.network && !skill.permissions.network.bounds) {
      errors.push(`Skill ${skill.skillId || idx} has network permission without bounds allowlist`);
    }
    if (skill.inputs && typeof skill.inputs === 'object' && skill.inputs.allowUndeclared === true) {
      errors.push(`Skill ${skill.skillId || idx} inputs must enforce additionalProperties: false`);
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Toolforge Manifest Schema Validator Suite', () => {
  const schemaPath = path.resolve('schemas/toolforge-manifest-schema.json');

  it('validates schema file existence and root properties', () => {
    assert.ok(fs.existsSync(schemaPath), 'Schema file must exist on disk');
    const content = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.equal(content.title, 'ToolforgeManifest');
    assert.equal(content.$id, 'https://toolforge.rewrite.internal/schemas/v1/manifest.json');
    assert.ok(content.required.includes('manifestVersion'));
    assert.ok(content.required.includes('skills'));
  });

  it('accepts a fully compliant skill manifest', () => {
    const validManifest = {
      manifestVersion: '1.0.0',
      name: 'trm-self-healing',
      packageName: '@toolforge/trm-self-healing',
      version: '1.0.0',
      description: 'DevOps diagnostic and self-healing triage skills',
      skills: [
        {
          skillId: 'trm-tinyfish-triage',
          packageName: '@toolforge/trm-self-healing',
          name: 'Tier-1 TinyFish Triage',
          version: '1.0.0',
          description: 'Fast local error signature matching and TinyFish search',
          entry: 'src/trm-tinyfish-triage.mjs',
          runtime: 'node',
          inputs: { type: 'object', required: ['logTrace'], additionalProperties: false },
          outputs: { type: 'object', required: ['status', 'category', 'resolution'], additionalProperties: false },
          permissions: {
            filesystem: 'read-only',
            network: { bounds: ['api.tinyfish.io'] }
          },
          env: {
            TINYFISH_API_KEY: { required: true, sensitive: true }
          }
        }
      ]
    };
    const result = validateManifestPayload(validManifest);
    assert.ok(result.valid, `Expected valid manifest, got errors: ${result.errors.join(', ')}`);
  });

  it('rejects manifest missing skillId', () => {
    const invalidManifest = {
      manifestVersion: '1.0.0',
      name: 'trm-self-healing',
      skills: [{ name: 'Missing ID', entry: 'src/index.mjs' }]
    };
    const result = validateManifestPayload(invalidManifest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('missing required field: skillId')));
  });

  it('rejects network permission without explicit bounds', () => {
    const invalidManifest = {
      manifestVersion: '1.0.0',
      name: 'trm-self-healing',
      skills: [
        {
          skillId: 'unbounded-net-tool',
          packageName: '@toolforge/test',
          entry: 'src/index.mjs',
          permissions: { network: { enabled: true } }
        }
      ]
    };
    const result = validateManifestPayload(invalidManifest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('without bounds allowlist')));
  });

  it('rejects unknown manifestVersion', () => {
    const invalidManifest = {
      manifestVersion: '0.5.0-legacy',
      name: 'trm-self-healing',
      skills: []
    };
    const result = validateManifestPayload(invalidManifest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Unknown or unsupported manifestVersion')));
  });
});

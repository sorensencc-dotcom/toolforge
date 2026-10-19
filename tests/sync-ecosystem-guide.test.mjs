import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  resolveSyncTargets,
  syncEcosystemGuide,
  KEY_CLUSTER_NOTEBOOKS,
  GUIDE_PATH,
  REGISTRY_PATH
} from '../scripts/sync-ecosystem-guide.mjs';

describe('Sync Ecosystem Guide Suite', () => {
  it('canonical architecture guide file exists on disk', () => {
    assert.ok(fs.existsSync(GUIDE_PATH), `Guide file not found at ${GUIDE_PATH}`);
    const stat = fs.statSync(GUIDE_PATH);
    assert.ok(stat.size > 1000, 'Guide file is too small');
  });

  it('resolveSyncTargets defaults to key cluster of 5 core notebooks', () => {
    const targets = resolveSyncTargets();
    assert.equal(targets.length, 5, `Expected 5 key cluster targets, got ${targets.length}`);
    const ids = new Set(targets.map((t) => t.id));
    assert.ok(ids.has('bec5a197-8256-4eba-af78-c4881cc28fdd'), 'AI News and Tools must be included');
    assert.ok(ids.has('c17c2a18-3562-4fe4-9880-c1289ec5f506'), 'Operations Briefings must be included');
    assert.ok(ids.has('679b8bab-2d87-42cb-a726-6dc54c83acc2'), 'CIC-KB must be included');
    assert.ok(ids.has('cb0498ce-1ea5-4668-9f65-ac368753404e'), 'Open Dev Issues must be included');
    assert.ok(ids.has('140119ae-3496-45c9-bf0c-71c955136afc'), 'Rewrite Labs must be included');
  });

  it('resolveSyncTargets loads all 31 notebooks when cluster is "all"', () => {
    const targets = resolveSyncTargets({ cluster: 'all' });
    assert.equal(targets.length, 31, `Expected 31 targets, got ${targets.length}`);

    const ids = new Set(targets.map((t) => t.id));
    assert.ok(ids.has('679b8bab-2d87-42cb-a726-6dc54c83acc2'), 'CIC-KB must be targeted');
    assert.ok(ids.has('76e1932c-054a-4520-9e83-5e882dffc938'), 'IronLedger must be targeted');
    assert.ok(ids.has('26eacb85-2c97-443d-9d81-3bd99cc98412'), 'Sigil must be targeted');
    assert.ok(ids.has('9724e682-c5ea-4693-8e21-caf8de68611e'), 'Personal OS must be targeted');
  });

  it('resolveSyncTargets falls back to key cluster if registry path does not exist', () => {
    const nonExistentPath = path.join(os.tmpdir(), 'non-existent-reg-' + Date.now() + '.json');
    const targets = resolveSyncTargets({ cluster: 'all', registryPath: nonExistentPath });

    assert.equal(targets.length, 5);
    const names = targets.map((t) => t.name);
    assert.ok(names.includes('CIC-KB'));
    assert.ok(names.includes('AI News and Tools'));
  });

  it('syncEcosystemGuide performs dry-run sweep end-to-end for key cluster', async () => {
    const result = await syncEcosystemGuide({ dryRun: true, cluster: 'key', pacingMs: 0 });
    assert.equal(result.success, true);
    assert.equal(result.targetsCount, 5);
  });

  it('syncEcosystemGuide performs dry-run sweep end-to-end for all cluster', async () => {
    const result = await syncEcosystemGuide({ dryRun: true, cluster: 'all', pacingMs: 0 });
    assert.equal(result.success, true);
    assert.equal(result.targetsCount, 31);
  });

  it('syncEcosystemGuide supports compile-only mode', async () => {
    const result = await syncEcosystemGuide({ compileOnly: true });
    assert.equal(result.success, true);
    assert.equal(result.compiledOnly, true);
    assert.ok(result.compileResult);
    assert.equal(result.compileResult.notebookCount, 31);
  });

  it('canonical registry contains 31 notebooks with valid synthesis_profile and metadata', () => {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    assert.equal(reg.notebooks.length, 31, 'Registry must contain exactly 31 notebooks');
    for (const nb of reg.notebooks) {
      assert.ok(nb.notebook_id, `Notebook must have notebook_id: ${nb.title}`);
      assert.ok(nb.title, `Notebook must have title: ${nb.notebook_id}`);
      assert.ok(nb.url, `Notebook must have url: ${nb.title}`);
      assert.ok(nb.synthesis_profile, `Notebook must have synthesis_profile: ${nb.title}`);
      assert.ok(
        ['operational_systems', 'operational_client', 'research_narrative'].includes(nb.synthesis_profile),
        `Unexpected synthesis_profile "${nb.synthesis_profile}" for notebook "${nb.title}"`
      );
      assert.ok(typeof nb.last_pulled_hashes === 'object', `last_pulled_hashes must be object in ${nb.title}`);
      assert.ok(typeof nb.quarantined === 'object', `quarantined must be object in ${nb.title}`);
    }
  });
});

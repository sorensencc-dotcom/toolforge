import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntityTopicRegistry, ETR_RULES } from '../scripts/validate-trm-semantics.mjs';

test('validateEntityTopicRegistry passes for valid manifest and categories', () => {
  const validManifest = {
    version: '1.0.0',
    updated_at: '2026-09-21T00:00:00.000Z',
    entities: {
      'test-entity': {
        canonical_name: 'Test Entity',
        primary_category: 'willow-run',
        aliases: ['Test', 'Test Alias'],
        l0_summary: 'Test summary description exceeding twenty characters.'
      }
    }
  };
  const categoriesData = {
    categories: {
      'willow-run': { target: '6fd7c40b-df90-444b-9c7a-a64682925856', title: 'Willow Run', status: 'canonical' }
    }
  };

  const res = validateEntityTopicRegistry(validManifest, categoriesData);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test('validateEntityTopicRegistry catches alias collision across entities', () => {
  const invalidManifest = {
    version: '1.0.0',
    updated_at: '2026-09-21T00:00:00.000Z',
    entities: {
      'entity-a': {
        canonical_name: 'Entity A',
        primary_category: 'willow-run',
        aliases: ['SharedAlias'],
        l0_summary: 'Valid summary for entity A in test.'
      },
      'entity-b': {
        canonical_name: 'Entity B',
        primary_category: 'willow-run',
        aliases: ['sharedalias'],
        l0_summary: 'Valid summary for entity B in test.'
      }
    }
  };
  const categoriesData = {
    categories: { 'willow-run': { target: '6fd7c40b-df90-444b-9c7a-a64682925856', status: 'canonical' } }
  };

  const res = validateEntityTopicRegistry(invalidManifest, categoriesData);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => e.rule_id === ETR_RULES.ALIAS_COLLISION));
});

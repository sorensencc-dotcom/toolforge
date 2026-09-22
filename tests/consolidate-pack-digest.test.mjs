import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectCrossNotebookDigests } from '../scripts/consolidate-pack.mjs';

test('injectCrossNotebookDigests appends digest using word boundaries and prevents duplicates', () => {
  const content = 'Sorensen oversaw the Willow Run factory, while CESOR handled offshore sugar operations. Bennett opposed Edsel.';
  const manifest = {
    entities: {
      'charles-e-sorensen': {
        canonical_name: 'Charles E. Sorensen', primary_category: 'willow-run', aliases: ['Sorensen'], l0_summary: 'Head of Ford manufacturing.'
      },
      'cesor-corporation': {
        canonical_name: 'CESOR Corporation', primary_category: 'cuba-claims', aliases: ['CESOR'], l0_summary: 'Cuban asset management entity.'
      },
      'harry-bennett': {
        canonical_name: 'Harry Bennett', primary_category: 'ford-politics', aliases: ['Bennett'], l0_summary: 'Head of Ford Service Department.'
      },
      'edsel': {
        canonical_name: 'Edsel', primary_category: 'ford-politics', aliases: ['Edsel'], l0_summary: 'Ford executive.'
      }
    }
  };
  const categoriesData = { categories: {
    'willow-run': { target: 'uuid-willow' }, 'cuba-claims': { target: 'uuid-cuba' }, 'ford-politics': { target: 'uuid-ford' }
  } };

  const injected = injectCrossNotebookDigests(content, 'willow-run', manifest, categoriesData);
  assert.equal(injected.includes('CROSS-NOTEBOOK DIGEST: Charles E. Sorensen'), false);
  assert.ok(injected.includes('=== CROSS-NOTEBOOK DIGEST: CESOR Corporation ==='));
  assert.ok(injected.includes('=== CROSS-NOTEBOOK DIGEST: Harry Bennett ==='));
  assert.ok(injected.includes('Target Notebook ID: uuid-cuba'));
  assert.equal(injectCrossNotebookDigests(injected, 'willow-run', manifest, categoriesData).match(/CROSS-NOTEBOOK DIGEST:/g).length, 3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanupQualityPublications } from './helpers/quality-cleanup.mjs';

export const calibrationQueries = [
  { split: 'tuning', target: 0, query: 'What happens to indexed content when vector generation fails?' },
  { split: 'tuning', target: 1, query: 'Can an outdated login token read another project?' },
  { split: 'tuning', target: 2, query: 'How should a broken schema upgrade recover?' },
  { split: 'tuning', target: null, query: 'How do I configure GPU memory allocation for chat inference?' },
  { split: 'tuning', target: null, query: 'Which payroll tax rate applies to a new employee?' },
  { split: 'tuning', target: null, query: 'How should a browser password manager synchronize saved logins?' },
  { split: 'heldout', target: 0, query: 'Does a failed embedding request erase previously published research paragraphs?' },
  { split: 'heldout', target: 1, query: 'What limits access for an authenticated research reader whose token has expired?' },
  { split: 'heldout', target: 2, query: 'What is the rollback and cleanup procedure after a database enhancement fails?' },
  { split: 'heldout', target: null, query: 'How can I restore deleted photographs from a damaged hard drive?' },
  { split: 'heldout', target: null, query: 'Which database connection pool size improves transaction throughput?' },
  { split: 'heldout', target: null, query: 'How do I rotate a TLS certificate for a public web server?' },
];

export function measure(rows, threshold) {
  const positives = rows.filter(row => row.target !== null);
  const negatives = rows.filter(row => row.target === null);
  return {
    correct: positives.filter(row => row.top === row.target && row.score > threshold).length,
    positives: positives.length,
    falsePositives: negatives.filter(row => row.score > threshold).length,
    negatives: negatives.length,
  };
}

export function selectThreshold(rows) {
  // Freeze grid and selection rule before live scores; held-out rows never tune it.
  return Array.from({ length: 101 }, (_, index) => index / 100).find(threshold => {
    const metrics = measure(rows, threshold);
    return metrics.positives > 0 && metrics.negatives > 0 &&
      metrics.correct === metrics.positives && metrics.falsePositives === 0;
  });
}

test('calibration respects strict SQL threshold, ranking, and infeasible separation', () => {
  const rows = [{ target: 0, top: 0, score: 0.57 }, { target: null, top: 1, score: 0.42 }];
  assert.equal(selectThreshold(rows), 0.42);
  assert.deepEqual(measure(rows, 0.57), { correct: 0, positives: 1, falsePositives: 0, negatives: 1 });
  assert.equal(selectThreshold([{ ...rows[0], top: 1 }, rows[1]]), undefined);
  assert.equal(selectThreshold([rows[0], { ...rows[1], score: 0.57 }]), undefined);
  assert.equal(selectThreshold([rows[0]]), undefined);
  assert.equal(calibrationQueries.filter(row => row.split === 'tuning').length, 6);
  assert.equal(calibrationQueries.filter(row => row.split === 'heldout').length, 6);
});

test('calibration command explicitly activates local-only assessment', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.scripts['test:calibration'].endsWith('tests/calibration-live.test.mjs'));
  const launcher = await readFile(new URL('./calibration-live.test.mjs', import.meta.url), 'utf8');
  assert.ok(launcher.includes("process.env.RESEARCH_UAT_CALIBRATION = '1'"));
});

test('quality cleanup independently discovers partial publications and fails closed', async () => {
  const ids = [];
  const calls = [];
  let exists = true;
  const service = { from: table => ({
    select: () => ({ in: async (column, values) => {
      calls.push([table, column, values]);
      return { data: table === 'documents' && exists ? [{ id: 'partial' }] : [], error: null };
    } }),
    delete: () => ({ in: async (column, values) => {
      calls.push(['delete', column, values]);
      exists = false;
      return { data: null, error: null };
    } }),
  }) };
  await cleanupQualityPublications(service, ['owned/path.md'], ids);
  assert.deepEqual(ids, ['partial']);
  assert.ok(calls.some(([table, column]) => table === 'research_items' && column === 'document_id'));
  assert.ok(calls.some(([table, column, values]) => table === 'delete' && column === 'git_path' && values[0] === 'owned/path.md'));
  await assert.rejects(cleanupQualityPublications({ from: () => ({ select: () => ({ in: async () => ({ error: {} }) }) }) }, ['owned/path.md'], []));
});

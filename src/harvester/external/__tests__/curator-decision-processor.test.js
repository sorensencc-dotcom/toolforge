import test from 'node:test';
import assert from 'node:assert';
import { processDecisions, buildIngestManifest } from '../curator-decision-processor.mjs';

function fixtureDecisions() {
  return {
    batch_id: 'willow-run-001',
    verification_notes: { attribution_required: '© Test Archive' },
    decisions: [
      { photo_id: '75904', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.92, verified: true },
      { photo_id: '76100', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.70, verified: true },
      { photo_id: '78626', decision: 'new-fact', topics: [], confidence: 0.55, verified: false },
      { photo_id: '76001', decision: 'reject', topics: [], confidence: 0.10, verified: false }
    ]
  };
}

test('processDecisions buckets link-to-fact, new-fact, and reject actions', () => {
  const results = processDecisions(fixtureDecisions());

  assert.strictEqual(results.total_processed, 4);
  assert.strictEqual(results.approved_links.length, 2);
  assert.strictEqual(results.new_facts.length, 1);
  assert.strictEqual(results.rejected_photos.length, 1);

  assert.strictEqual(results.new_facts[0].photo_id, '78626');
  assert.strictEqual(results.rejected_photos[0].photo_id, '76001');
});

test('processDecisions applies verification_notes attribution when present', () => {
  const results = processDecisions(fixtureDecisions());
  assert.strictEqual(results.approved_links[0].attribution, '© Test Archive');
});

test('processDecisions falls back to default attribution when verification_notes absent', () => {
  const decisions = fixtureDecisions();
  delete decisions.verification_notes;
  const results = processDecisions(decisions);
  assert.strictEqual(results.approved_links[0].attribution, '© Michigan Flight Museum');
});

test('processDecisions ignores unrecognized decision actions but still counts them', () => {
  const decisions = fixtureDecisions();
  decisions.decisions.push({ photo_id: '99999', decision: 'defer', topics: [], confidence: 0.3, verified: false });
  const results = processDecisions(decisions);

  assert.strictEqual(results.total_processed, 5);
  assert.strictEqual(results.approved_links.length, 2);
  assert.strictEqual(results.new_facts.length, 1);
  assert.strictEqual(results.rejected_photos.length, 1);
});

test('buildIngestManifest tiers approved photos HIGH/MEDIUM by 0.80 confidence threshold', () => {
  const decisions = fixtureDecisions();
  const results = processDecisions(decisions);
  const manifest = buildIngestManifest(decisions, results);

  const byId = Object.fromEntries(manifest.approved_photos.map(p => [p.photo_id, p]));
  assert.strictEqual(byId['75904'].priority, 'HIGH');
  assert.strictEqual(byId['76100'].priority, 'MEDIUM');
});

test('buildIngestManifest summary counts match results', () => {
  const decisions = fixtureDecisions();
  const results = processDecisions(decisions);
  const manifest = buildIngestManifest(decisions, results);

  assert.strictEqual(manifest.total_photos, results.total_processed);
  assert.strictEqual(manifest.summary.approved_for_ingest, results.approved_links.length);
  assert.strictEqual(manifest.summary.new_fact_candidates, results.new_facts.length);
  assert.strictEqual(manifest.summary.rejected, results.rejected_photos.length);
  assert.strictEqual(manifest.curator_review_complete, true);
});

test('buildIngestManifest carries new_fact_candidates and rejected_photos through unchanged', () => {
  const decisions = fixtureDecisions();
  const results = processDecisions(decisions);
  const manifest = buildIngestManifest(decisions, results);

  assert.deepStrictEqual(manifest.new_fact_candidates, results.new_facts);
  assert.deepStrictEqual(manifest.rejected_photos, results.rejected_photos);
});

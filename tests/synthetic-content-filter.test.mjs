import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateShannonEntropy,
  calculateCompressionRatio,
  detectSlopMarkers,
  evaluateProvenanceGrounding,
  evaluateContentGate,
  KISP_MAX_CHUNK_BYTES
} from '../scripts/synthetic-content-filter.mjs';

test('SyntheticContentFilter - calculates Shannon entropy correctly', () => {
  const uniformText = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const naturalText = 'Cast Iron Charlie oversaw high-speed manufacturing assembly lines with rigorous metallurgical testing.';
  const entropyUniform = calculateShannonEntropy(uniformText);
  const entropyNatural = calculateShannonEntropy(naturalText);

  assert.equal(entropyUniform, 0);
  assert.ok(entropyNatural > 4.0, `Expected entropy > 4.0, got ${entropyNatural}`);
});

test('SyntheticContentFilter - calculates compression ratio for repetitive strings', () => {
  const repeating = 'The quick brown fox jumps over the lazy dog. '.repeat(50);
  const natural = 'In 1942, Sorensen resolved production bottlenecks at the Fort Worth Consolidated plant by standardizing subassembly tooling and die tolerances.';
  
  const ratioRepetitive = calculateCompressionRatio(repeating);
  const ratioNatural = calculateCompressionRatio(natural);

  assert.ok(ratioRepetitive < 0.15, `Expected ratio < 0.15, got ${ratioRepetitive}`);
  assert.ok(ratioNatural > 0.60, `Expected ratio > 0.60, got ${ratioNatural}`);
});

test('SyntheticContentFilter - detects synthetic AI slop markers', () => {
  const slop = 'Certainly! Here is an overview. In conclusion, it is crucial to remember that navigating the landscape is a testament to the future.';
  const matches = detectSlopMarkers(slop);

  assert.ok(matches.length >= 3, `Expected at least 3 matches, got ${matches.length}`);
  assert.ok(matches.some(m => /certainly!/i.test(m)));
});

test('SyntheticContentFilter - evaluates ground-truth provenance and citations', () => {
  const ungrounded = 'The alloy was fabricated using special heat-treating methods.';
  const grounded = 'According to archival documents in RFC #42 and https://archives.ford.org/record/1942, the alloy met ASTM specs [[MetallurgyIndex]].';

  const provUngrounded = evaluateProvenanceGrounding(ungrounded);
  const provGrounded = evaluateProvenanceGrounding(grounded);

  assert.equal(provUngrounded.grounded, false);
  assert.equal(provGrounded.grounded, true);
  assert.ok(provGrounded.evidenceCount >= 3);
});

test('SyntheticContentFilter - rejects oversized buffer exceeding KIS-P limit', () => {
  const oversized = 'x'.repeat(KISP_MAX_CHUNK_BYTES + 1024);
  const result = evaluateContentGate(oversized);

  assert.equal(result.verdict, 'REJECT');
  assert.equal(result.score, 0);
  assert.ok(result.reasons[0].includes('exceeds KIS-P limit'));
});

test('SyntheticContentFilter - rejects low-entropy synthetic slop', () => {
  const syntheticSlop = 'As an AI language model, certainly! Here is a summary. Delve into the rich tapestry of automotive manufacturing. In conclusion, it is crucial to remember that seamless integration is game-changing.';
  const result = evaluateContentGate(syntheticSlop);

  assert.equal(result.verdict, 'REJECT');
  assert.ok(result.score <= 0.45);
  assert.ok(result.metrics.slopMatches.length >= 3);
});

test('SyntheticContentFilter - passes authentic grounded historical research', () => {
  const authenticResearch = `
# Cast Iron Charlie: Willow Run Production Architecture

Archival evidence from RFC #12 and primary sources (https://thehenryford.org/collections-and-research/digital-collections/artifact/382910) establish that Charles E. Sorensen designed the unified B-24 Liberator bomber layout in May 1941 at the Coronado Hotel.

Key metallurgical constraints included:
1. Alclad 24S-T sheet aluminum skin stamping with 0.040" tolerance bounds.
2. Centrifugal cast steel landing gear struts replacing forged assemblies to eliminate machining queues.
3. Cold-riveting stations utilizing specialized pneumatic yokes.

Citation: [[WillowRunEngineering]]
`;

  const result = evaluateContentGate(authenticResearch, { requireProvenance: true });

  assert.equal(result.verdict, 'PASS');
  assert.ok(result.score >= 0.85);
  assert.equal(result.metrics.slopMatches.length, 0);
  assert.equal(result.metrics.provenance.grounded, true);
});

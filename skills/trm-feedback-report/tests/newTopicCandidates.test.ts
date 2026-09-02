import { findNewTopicCandidates, slugify } from '../src/newTopicCandidates';

describe('slugify', () => {
  it('lowercases, hyphenates spaces, strips punctuation', () => {
    expect(slugify('Charles Sorensen')).toBe('charles-sorensen');
    expect(slugify("Willow Run's Plant")).toBe('willow-runs-plant');
  });
});

describe('findNewTopicCandidates', () => {
  const baseFacts = [
    { id: 'FCT-001', text: 'Charles Sorensen toured the plant in 1943.', source_id: 'SRC-001', confidence: 0.9 },
    { id: 'FCT-002', text: 'Charles Sorensen approved the new line layout.', source_id: 'SRC-002', confidence: 0.7 },
    { id: 'FCT-003', text: 'Records show Charles Sorensen visited weekly.', source_id: 'SRC-003', confidence: 0.6 },
  ];

  it('flags a phrase clearing all three guardrails as a candidate', () => {
    const candidates = findNewTopicCandidates(baseFacts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(true);
  });

  it('does not flag a phrase appearing in fewer than 3 facts', () => {
    const facts = baseFacts.slice(0, 2);
    const candidates = findNewTopicCandidates(facts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });

  it('does not flag a phrase drawn from only 1 distinct source', () => {
    const facts = baseFacts.map((f) => ({ ...f, source_id: 'SRC-001' }));
    const candidates = findNewTopicCandidates(facts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });

  it('does not flag a phrase whose average confidence is below 0.55', () => {
    const facts = baseFacts.map((f) => ({ ...f, confidence: 0.2 }));
    const candidates = findNewTopicCandidates(facts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });

  it('does not flag a phrase whose slug already exists as a tag/path segment', () => {
    const candidates = findNewTopicCandidates(baseFacts, ['charlie/charles-sorensen']);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });
});

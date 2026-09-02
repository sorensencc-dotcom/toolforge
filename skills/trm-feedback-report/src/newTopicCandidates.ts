export interface CandidateFactRef {
  factId: string;
  sourceId: string;
  confidence: number;
}

export interface TopicCandidate {
  phrase: string;
  slug: string;
  factRefs: CandidateFactRef[];
  sourceCount: number;
  avgConfidence: number;
}

export interface FeedbackFact {
  id: string;
  text: string;
  source_id: string;
  confidence: number;
}

const TITLE_CASE_PHRASE_RE = /\b[A-Z][a-z]+(?:['’]?[a-z]*)?(?:\s+[A-Z][a-z]+(?:['’]?[a-z]*)?)+\b/g;

export function slugify(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function findNewTopicCandidates(facts: FeedbackFact[], existingSlugs: string[]): TopicCandidate[] {
  const byPhrase = new Map<string, { label: string; refs: CandidateFactRef[] }>();

  for (const fact of facts) {
    const matches = fact.text.match(TITLE_CASE_PHRASE_RE) ?? [];
    for (const phrase of matches) {
      const slug = slugify(phrase);
      const entry = byPhrase.get(slug) ?? { label: phrase, refs: [] };
      entry.refs.push({ factId: fact.id, sourceId: fact.source_id, confidence: fact.confidence });
      byPhrase.set(slug, entry);
    }
  }

  const candidates: TopicCandidate[] = [];
  for (const [slug, { label, refs }] of byPhrase) {
    if (refs.length < 3) continue;

    const distinctSources = new Set(refs.map((r) => r.sourceId));
    if (distinctSources.size < 2) continue;

    const avgConfidence = refs.reduce((sum, r) => sum + r.confidence, 0) / refs.length;
    if (avgConfidence < 0.55) continue;

    const alreadyExists = existingSlugs.some((existing) => existing === slug || existing.includes(slug));
    if (alreadyExists) continue;

    candidates.push({ phrase: label, slug, factRefs: refs, sourceCount: distinctSources.size, avgConfidence });
  }

  return candidates;
}

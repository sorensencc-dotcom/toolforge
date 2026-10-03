// Matches balanced parentheticals: (content), [content], {content}
const BALANCED_PARENTHETICAL_REGEX = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g;

// Matches quotes, backticks, residual brackets, and non-terminal pause punctuation
const QUOTES_AND_PAUSES_REGEX = /["'`“”‘’()\[\]{},-]/g;

// Matches negation tokens and optional modifier/filler adverbs in active clause
const CLAUSE_NEGATION_REGEX =
  /(?:^|\b)(?:not|never|no|non|hardly|scarcely|neither|without|(?:ain|isn|aren|wasn|weren|won|don|doesn|didn|can)['\s]?t)(?:\s+(?:a|an|the|very|really|overly|strictly|considered|quite|entirely|in|\w+ly))*$/i;

// Hard clause terminators that break the lookback window
const CLAUSE_TERMINATORS_REGEX = /[\.\!\?;\n\r]+/;

/**
 * Normalizes an active clause fragment by:
 * 1. Removing balanced parentheticals and inner content
 * 2. Stripping quotes and pause punctuation
 * 3. Collapsing multiple whitespace intervals
 */
export function normalizeClause(rawClause: string): string {
  return rawClause
    .replace(BALANCED_PARENTHETICAL_REGEX, ' ')
    .replace(QUOTES_AND_PAUSES_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a keyword occurs affirmatively in a text body.
 * - Rejects occurrences prefixed with 'non-' or preceded by negation adverbs in the SAME clause.
 * - Ensures sentence terminators (. ! ? ; \n) break the lookback window.
 * - Handles parenthetical asides and quote marks between negation and target.
 */
export function hasAffirmativeMatch(text: string, keyword: string): boolean {
  const pattern = new RegExp(`(\\b(?:non-?)?)(${keyword})\\b`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const prefixHyphen = match[1].toLowerCase();
    const matchIndex = match.index;

    // 1. Direct hyphenated negation check (e.g. "non-blocking", "non-critical")
    if (prefixHyphen.startsWith('non')) {
      continue;
    }

    // 2. Extract preceding window (up to 60 characters to allow for parentheticals)
    const windowStart = Math.max(0, matchIndex - 60);
    const rawPrecedingText = text.slice(windowStart, matchIndex);

    // 3. Clause Boundary Guard: isolate current clause fragment
    const clauseFragments = rawPrecedingText.split(CLAUSE_TERMINATORS_REGEX);
    const rawActiveClause = clauseFragments[clauseFragments.length - 1];

    // 4. Normalize: drop parenthetical asides, quotes, commas, and excess spaces
    const normalizedActiveClause = normalizeClause(rawActiveClause);

    // 5. Test if normalized clause concludes with a negation pattern
    if (CLAUSE_NEGATION_REGEX.test(normalizedActiveClause)) {
      continue; // Negated in active clause; proceed to subsequent occurrences
    }

    return true; // Found un-negated affirmative match
  }

  return false;
}

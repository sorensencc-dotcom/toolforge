/**
 * no-ai-slop.mjs - Toolforge Quality Gate Linter
 * Scans documentation, pull requests, and commit messages for 20+ AI slop patterns.
 */

export const SLOP_PATTERNS = [
  { pattern: /\bdelve(s|d|ing)?\b/gi, phrase: "delve" },
  { pattern: /\btestament to\b/gi, phrase: "testament to" },
  { pattern: /\btapestry of\b/gi, phrase: "tapestry of" },
  { pattern: /\bbeacon of\b/gi, phrase: "beacon of" },
  { pattern: /\bvital role\b/gi, phrase: "vital role" },
  { pattern: /\blandscape of\b/gi, phrase: "landscape of" },
  { pattern: /\bharness(ing|ed)?\b/gi, phrase: "harness" },
  { pattern: /\bfoster(s|ing|ed)?\b/gi, phrase: "foster" },
  { pattern: /\bintricate\b/gi, phrase: "intricate" },
  { pattern: /\bmultifaceted\b/gi, phrase: "multifaceted" },
  { pattern: /\brevolutioniz(e|ing|ed|es)\b/gi, phrase: "revolutionize" },
  { pattern: /\bgame-changer\b/gi, phrase: "game-changer" },
  { pattern: /\bparadigm shift\b/gi, phrase: "paradigm shift" },
  { pattern: /\bseamless(ly)?\b/gi, phrase: "seamlessly" },
  { pattern: /\bit is important to (note|remember|understand)\b/gi, phrase: "it is important to note" },
  { pattern: /\bin conclusion\b/gi, phrase: "in conclusion" },
  { pattern: /\bmoreover\b/gi, phrase: "moreover" },
  { pattern: /\bfurthermore\b/gi, phrase: "furthermore" },
  { pattern: /^based on (your|the) sources,?/gmi, phrase: "Based on your sources" },
  { pattern: /^as an ai language model,?/gmi, phrase: "As an AI language model" }
];

export function analyzeSlop(content, autoFix = false) {
  if (typeof content !== 'string') {
    return {
      clean: true,
      violationsFound: [],
      sanitizedContent: ''
    };
  }

  const violations = [];
  let sanitized = content;

  for (const item of SLOP_PATTERNS) {
    const matches = content.match(item.pattern);
    if (matches && matches.length > 0) {
      violations.push(`${item.phrase} (${matches.length}x)`);

      if (autoFix) {
        if (item.phrase === "Based on your sources" || item.phrase === "As an AI language model") {
          sanitized = sanitized.replace(item.pattern, '');
        } else if (item.phrase === "delve" || item.phrase === "delves" || item.phrase === "delving") {
          sanitized = sanitized.replace(item.pattern, 'explore');
        } else if (item.phrase === "seamlessly") {
          sanitized = sanitized.replace(item.pattern, 'directly');
        } else if (item.phrase === "vital role") {
          sanitized = sanitized.replace(item.pattern, 'key role');
        } else if (item.phrase === "landscape of") {
          sanitized = sanitized.replace(item.pattern, 'field of');
        } else {
          sanitized = sanitized.replace(item.pattern, '');
        }
      }
    }
  }

  if (autoFix) {
    sanitized = sanitized.replace(/ {2,}/g, ' ').replace(/ ,/g, ',').trim();
  }

  return {
    clean: violations.length === 0,
    violationsFound: violations,
    sanitizedContent: sanitized
  };
}

export default { analyzeSlop, SLOP_PATTERNS };

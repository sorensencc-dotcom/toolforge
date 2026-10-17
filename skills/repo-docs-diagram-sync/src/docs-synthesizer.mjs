// skills/repo-docs-diagram-sync/src/docs-synthesizer.mjs
import fs from 'node:fs';
import path from 'node:path';

export const HEURISTIC_RULES = {
  THROAT_CLEARING: 'ban-throat-clearing',
  FILLER_ADVERBS: 'ban-filler-adverbs',
  FIRST_PERSON_PLURAL: 'avoid-first-person-plural',
  ACTIVE_VOICE: 'active-voice',
  CONDITION_BEFORE_ACTION: 'condition-before-action',
  HEADING_SENTENCE_CASE: 'heading-sentence-case',
  DESCRIPTIVE_LINKS: 'descriptive-links',
  SERIAL_COMMA: 'serial-comma',
};

const THROAT_CLEARING_REGEX = /^(?:Certainly!?|Sure thing!?|In this section,?\s+(?:we will|you can)?|Allow me to|Let's delve)/i;
const FILLER_ADVERBS_REGEX = /\b(essentially|basically|game-changing|delve|seamlessly|vastly superior|blazing fast)\b/i;
const FIRST_PERSON_PLURAL_REGEX = /\b(we recommend|we will|let's|in our opinion)\b/i;
const PASSIVE_VOICE_REGEX = /\b(?:is|are|was|were|been|being)\s+([a-z]+ed)\s+by\b/i;
const GENERIC_LINK_REGEX = /\[(here|click here|link|this page)\]\(/i;

/**
 * Checks markdown text line by line for writing-heuristics violations.
 * @param {string} markdown
 * @param {string} [filename='unknown.md']
 * @returns {Array<{ rule: string, line: number, text: string, message: string }>}
 */
export function auditMarkdownText(markdown, filename = 'unknown.md') {
  const violations = [];
  const lines = markdown.split(/\r?\n/);

  let inCodeBlock = false;
  const activeExemptions = new Set();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const trimmed = rawLine.trim();

    // Track code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Check suppression directives
    const disableMatch = trimmed.match(/<!--\s*heuristics-disable\s+([a-z0-9_-]+)(?:\s+author="([^"]*)")?(?:\s+reason="([^"]*)")?(?:\s+until="([^"]*)")?/i);
    if (disableMatch) {
      const [, rule, , , until] = disableMatch;
      let expired = false;
      if (until) {
        const expiryDate = new Date(until);
        if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
          expired = true;
        }
      }
      if (!expired) {
        activeExemptions.add(rule.toLowerCase());
      }
      continue;
    }
    const enableMatch = trimmed.match(/<!--\s*heuristics-enable\s+([a-z0-9_-]+)/i);
    if (enableMatch) {
      activeExemptions.delete(enableMatch[1].toLowerCase());
      continue;
    }

    if (!trimmed) continue;

    // 1. Heading sentence case
    if (/^#{1,6}\s+/.test(trimmed)) {
      if (!activeExemptions.has(HEURISTIC_RULES.HEADING_SENTENCE_CASE)) {
        const headingText = trimmed.replace(/^#{1,6}\s+/, '');
        if (isBadTitleCase(headingText)) {
          violations.push({
            rule: HEURISTIC_RULES.HEADING_SENTENCE_CASE,
            line: lineNum,
            text: trimmed,
            message: `Heading "${headingText}" must use Sentence case, not Title Case.`,
          });
        }
      }
      continue; // Skip body checks for headings
    }

    // 2. Throat clearing
    if (!activeExemptions.has(HEURISTIC_RULES.THROAT_CLEARING)) {
      if (THROAT_CLEARING_REGEX.test(trimmed)) {
        violations.push({
          rule: HEURISTIC_RULES.THROAT_CLEARING,
          line: lineNum,
          text: trimmed,
          message: 'Paragraph contains conversational throat-clearing.',
        });
      }
    }

    // 3. Filler adverbs and slop words
    if (!activeExemptions.has(HEURISTIC_RULES.FILLER_ADVERBS)) {
      const match = trimmed.match(FILLER_ADVERBS_REGEX);
      if (match) {
        violations.push({
          rule: HEURISTIC_RULES.FILLER_ADVERBS,
          line: lineNum,
          text: trimmed,
          message: `Filler adverb or slop phrase "${match[0]}" detected.`,
        });
      }
    }

    // 4. First-person plural
    if (!activeExemptions.has(HEURISTIC_RULES.FIRST_PERSON_PLURAL)) {
      const match = trimmed.match(FIRST_PERSON_PLURAL_REGEX);
      if (match) {
        violations.push({
          rule: HEURISTIC_RULES.FIRST_PERSON_PLURAL,
          line: lineNum,
          text: trimmed,
          message: `First-person plural construct "${match[0]}" found. Use direct imperative or second-person.`,
        });
      }
    }

    // 5. Active voice
    if (!activeExemptions.has(HEURISTIC_RULES.ACTIVE_VOICE)) {
      const match = trimmed.match(PASSIVE_VOICE_REGEX);
      if (match) {
        violations.push({
          rule: HEURISTIC_RULES.ACTIVE_VOICE,
          line: lineNum,
          text: trimmed,
          message: `Passive voice construct "${match[0]}" found. Rewrite in active voice.`,
        });
      }
    }

    // 6. Descriptive link text
    if (!activeExemptions.has(HEURISTIC_RULES.DESCRIPTIVE_LINKS)) {
      const match = trimmed.match(GENERIC_LINK_REGEX);
      if (match) {
        violations.push({
          rule: HEURISTIC_RULES.DESCRIPTIVE_LINKS,
          line: lineNum,
          text: trimmed,
          message: `Non-descriptive link anchor text "${match[1]}" found.`,
        });
      }
    }

    // 7. Serial Oxford comma
    if (!activeExemptions.has(HEURISTIC_RULES.SERIAL_COMMA)) {
      // Check for "... A, B and C" missing comma before coordinating conjunction
      const commaMatch = trimmed.match(/\b([A-Za-z0-9_-]+),\s+([A-Za-z0-9_-]+)\s+(and|or)\s+([A-Za-z0-9_-]+)\b/);
      if (commaMatch) {
        violations.push({
          rule: HEURISTIC_RULES.SERIAL_COMMA,
          line: lineNum,
          text: trimmed,
          message: `Missing serial Oxford comma before "${commaMatch[3]}".`,
        });
      }
    }
  }

  return violations;
}

/**
 * Checks if a heading appears to be in Title Case rather than Sentence case.
 * Ignores words in backticks and all-caps acronyms.
 */
export function isBadTitleCase(heading) {
  const words = heading
    .replace(/`[^`]*`/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean);

  if (words.length <= 1) return false;

  // If more than 50% of words (excluding short articles/prepositions) start with capital letters, flag as Title Case
  const stopWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'with', 'in', 'of']);
  let capitalizedCount = 0;
  let totalCandidates = 0;

  for (let idx = 1; idx < words.length; idx++) {
    const word = words[idx];
    if (stopWords.has(word.toLowerCase())) continue;
    if (word === word.toUpperCase() && word.length <= 4) continue; // Acronym like API, AWS, PR

    totalCandidates++;
    if (word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
      capitalizedCount++;
    }
  }

  return totalCandidates > 1 && capitalizedCount / totalCandidates >= 0.7;
}

/**
 * Normalizes wiki frontmatter title into a clean Markdown header or comment.
 */
export function normalizeWikiFrontmatter(content) {
  if (!/^---\r?\n/.test(content)) return content;
  const closingMatch = /\r?\n---(?:\r?\n|$)/.exec(content.slice(4));
  if (!closingMatch) return content;
  const closing = closingMatch.index + 4;
  const frontmatter = content.slice(4, closing);
  const match = frontmatter.match(/^(?:title|source_title):\s*["']?(.+?)["']?\s*$/m);
  const body = content.slice(closing + 4).trimStart();
  const sanitized = frontmatter.trim().replace(/-->/g, '-- >');
  const comment = `<!--\n---\n${sanitized}\n---\n-->\n\n`;
  if (!match || /^#\s/m.test(body)) return `${comment}${body}`;
  const title = match[1].replace(/["']$/, '').trim();
  return `${comment}# ${title}\n\n${body}`;
}

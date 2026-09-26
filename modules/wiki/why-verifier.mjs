/**
 * why-verifier.mjs
 *
 * Grounding verification engine for Topic Research Mining (TRM) closed-loop synthesis.
 * Implements deterministic matching against primary research gap cards in trm-vault.
 */

import * as fs from 'fs';
import * as path from 'path';

const KNOWN_CATEGORIES = new Set([
  'open-contradictions',
  'under-sourced',
  'adjacent-topics',
  'follow-up'
]);

function normalizePosix(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Splits a markdown table row by unescaped pipe characters.
 * @param {string} line
 * @returns {string[]}
 */
function splitTableRow(line) {
  // Split on pipe not preceded by a backslash
  const cells = line.split(/(?<!\\)\|/);
  return cells.map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
}

/**
 * Parses markdown gap card content into structured row entries.
 * @param {string} content
 * @param {string} [fileName='gap-card.md']
 * @returns {Array<{question: string, answer: string, notebook: string, date: string, entryKey: string, file: string}>}
 */
export function parseGapTableRows(content, fileName = 'gap-card.md') {
  const rows = [];
  const lines = content.split(/\r?\n/);
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.includes('|---|') || trimmed.includes('|:---|') || trimmed.includes('| Question |')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    const cells = splitTableRow(trimmed);
    if (cells.length >= 5) {
      rows.push({
        question: cells[0],
        answer: cells[1].replace(/\\\|/g, '|'),
        notebook: cells[2],
        date: cells[3],
        entryKey: cells[4],
        file: normalizePosix(fileName)
      });
    }
  }

  return rows;
}

/**
 * Verifies a topic against TRM research gap cards in the vault or provided content.
 *
 * @param {string} topicSlug - Topic category, notebook slug, or subject keyword
 * @param {Object} [options]
 * @param {string} [options.vaultPath] - Path to trm-vault root
 * @param {string} [options.gapsFilePath] - Path to explicit gap file
 * @param {string} [options.gapsContent] - In-memory gap card content
 * @returns {Object} WhyVerificationResult
 */
export function verifyTopicGaps(topicSlug, options = {}) {
  const slug = String(topicSlug || '').trim().toLowerCase();
  const vaultPath = options.vaultPath || process.env.TRM_VAULT || 'C:/Users/soren/trm-vault';
  const gapsDir = path.join(vaultPath, 'trm', 'research-gaps');

  let allRows = [];

  if (options.gapsContent) {
    allRows = parseGapTableRows(options.gapsContent, options.gapsFilePath || 'staged-gaps.md');
  } else if (options.gapsFilePath && fs.existsSync(options.gapsFilePath)) {
    const content = fs.readFileSync(options.gapsFilePath, 'utf8');
    allRows = parseGapTableRows(content, options.gapsFilePath);
  } else if (fs.existsSync(gapsDir)) {
    try {
      const files = fs.readdirSync(gapsDir).filter(f => f.endsWith('.md'));
      for (const f of files) {
        const fullPath = path.join(gapsDir, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        const rows = parseGapTableRows(content, fullPath);
        allRows.push(...rows);
      }
    } catch {
      // Graceful fallback on filesystem read error
    }
  }

  // Two-mode matching
  const isCategory = KNOWN_CATEGORIES.has(slug);
  const matchedRows = allRows.filter(r => {
    if (isCategory) {
      return r.entryKey.includes(`:${slug}:`);
    }
    // Topic / keyword mode: check file stem, question, or answer text
    const textToMatch = `${r.file} ${r.question} ${r.answer} ${r.notebook}`.toLowerCase();
    const cleanPhrase = slug.replace(/[-_]/g, ' ').trim();
    if (textToMatch.includes(cleanPhrase)) {
      return true;
    }
    const words = cleanPhrase.split(/\s+/).filter(w => w.length > 2);
    return words.length > 0 && words.every(w => textToMatch.includes(w));
  });


  if (matchedRows.length === 0) {
    return {
      topic: topicSlug,
      verdict: 'NO-EVIDENCE',
      verificationStatus: 'unverified',
      corroborated: false,
      sources: [],
      contradictions: [],
      evidenceBlockMarkdown: formatWhyEvidenceBlock({
        topic: topicSlug,
        verdict: 'NO-EVIDENCE',
        sources: [],
        contradictions: []
      })
    };
  }

  // Distinct source files
  const distinctFiles = new Set(matchedRows.map(r => r.file));
  const isCorroborated = distinctFiles.size >= 2;

  const sources = matchedRows.map(r => {
    const isUnderSourced = r.entryKey.includes(':under-sourced:');
    const isContradiction = r.entryKey.includes(':open-contradictions:');

    return {
      file: r.file,
      excerpt: r.answer,
      corroborated: isCorroborated,
      singleSourced: isUnderSourced,
      isContradiction,
      entryKey: r.entryKey,
      firstSeenDate: r.date
    };
  });

  const contradictions = sources
    .filter(s => s.isContradiction)
    .map(s => s.excerpt.slice(0, 140).trim() + (s.excerpt.length > 140 ? '...' : ''));

  // Status derivation
  let verificationStatus = 'verified';
  if (contradictions.length > 0) {
    verificationStatus = 'contradiction_flagged';
  } else if (sources.every(s => s.singleSourced) || (sources.length === 1 && sources[0].singleSourced)) {
    verificationStatus = 'single-sourced';
  } else if (!isCorroborated && sources.length === 1) {
    verificationStatus = 'verified'; // grounded in 1 validated notebook entry
  }

  const result = {
    topic: topicSlug,
    verdict: 'GROUNDED',
    verificationStatus,
    corroborated: isCorroborated,
    sources,
    contradictions,
    evidenceBlockMarkdown: ''
  };

  result.evidenceBlockMarkdown = formatWhyEvidenceBlock(result);
  return result;
}

/**
 * Formats a WHY-EVIDENCE markdown block from verification results.
 *
 * @param {Object} result
 * @returns {string} Collapsible details markdown block
 */
export function formatWhyEvidenceBlock(result) {
  const sourcesYaml = (result.sources || []).map(s => {
    return [
      `  - file: ${normalizePosix(s.file)}`,
      `    excerpt: "${s.excerpt.replace(/"/g, '\\"')}"`,
      `    corroborated: ${s.corroborated}`,
      `    single-sourced: ${s.singleSourced}`,
      `    entry_key: "${s.entryKey}"`
    ].join('\n');
  }).join('\n');

  const contradictionsYaml = (result.contradictions || []).length > 0
    ? result.contradictions.map(c => `  - "${c.replace(/"/g, '\\"')}"`).join('\n')
    : '[]';

  if (result.verdict === 'NO-EVIDENCE') {
    return [
      '<details>',
      '<summary><b>WHY-EVIDENCE Provenance Block</b></summary>',
      '',
      '## WHY-EVIDENCE',
      `query: "${result.topic}"`,
      'sources: []',
      'contradictions: []',
      'verdict: NO-EVIDENCE',
      '',
      '> **HOLD — No evidence found.** Cannot ground topic in primary research gap cards.',
      '',
      '</details>'
    ].join('\n');
  }

  return [
    '<details>',
    '<summary><b>WHY-EVIDENCE Provenance Block</b></summary>',
    '',
    '## WHY-EVIDENCE',
    `query: "${result.topic}"`,
    'sources:',
    sourcesYaml,
    `contradictions: ${contradictionsYaml.startsWith('  -') ? '\n' + contradictionsYaml : '[]'}`,
    `verdict: ${result.verdict}`,
    '',
    '</details>'
  ].join('\n');
}

#!/usr/bin/env node
/**
 * scripts/synthetic-content-filter.mjs
 *
 * Deterministic Synthetic Content Filtering Gate for CIC-KB Ingestion.
 * Evaluates candidate content against:
 * 1. Shannon entropy and compression ratio (repetitive boilerplate detection)
 * 2. Canned AI preamble and slop marker detection
 * 3. Provenance and source citation lineage grounding
 * 4. KIS-P buffer overflow size limits (<= 380 KiB)
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

export const KISP_MAX_CHUNK_BYTES = 380 * 1024; // 380 KiB limit for NotebookLM buffer safety

export const SYNTHETIC_SLOP_MARKERS = [
  /\bAs an AI language model\b/i,
  /\bIn summary, it is important to remember that\b/i,
  /\bCertainly! Here is (a|the|an)\b/i,
  /\bdelve into the (rich )?tapestry\b/i,
  /\bseamlessly (integrat|interfac|combin|bridg)\w*\b/i,
  /\btestament to the\b/i,
  /\bgame-changing\b/i,
  /\bnavigating the landscape\b/i,
  /\bIn conclusion, it is crucial to\b/i,
  /\bWithout further ado\b/i,
  /\bLet's dive into\b/i,
  /\bIt is worth noting that\b/i
];

export const PROVENANCE_INDICATORS = [
  /https?:\/\/[^\s)]+/i,
  /\b(RFC|PR|Issue)\s*#?\d+\b/i,
  /\b(?:sha256:[a-f0-9]{64}|commit\s+[a-f0-9]{7,40})\b/i,
  /\b(?:citation|source|reference|archival_id|ingest_source):\s*\S+/i,
  /\[\[[^\]]+\]\]/ // Obsidian wikilink
];

/**
 * Calculate Shannon entropy of text in bits per character.
 */
export function calculateShannonEntropy(text) {
  if (!text || text.length === 0) return 0;
  const freq = new Map();
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    freq.set(char, (freq.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = text.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Calculate zlib compression ratio (compressedSize / rawSize).
 * Lower ratio (< 0.20) indicates highly repetitive boilerplate text.
 */
export function calculateCompressionRatio(text) {
  if (!text || text.length === 0) return 1.0;
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length < 50) return 1.0;
  const compressed = zlib.deflateSync(buffer);
  return compressed.length / buffer.length;
}

/**
 * Audit text against synthetic slop markers.
 */
export function detectSlopMarkers(text) {
  const matches = [];
  for (const pattern of SYNTHETIC_SLOP_MARKERS) {
    const m = text.match(pattern);
    if (m) {
      matches.push(m[0]);
    }
  }
  return matches;
}

/**
 * Check for ground-truth provenance and source citations.
 */
export function evaluateProvenanceGrounding(text) {
  const detected = [];
  for (const pattern of PROVENANCE_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      detected.push(match[0]);
    }
  }
  return {
    grounded: detected.length > 0,
    evidenceCount: detected.length,
    samples: detected.slice(0, 3)
  };
}

/**
 * Evaluate candidate content against the full synthetic filtering gate rubric.
 */
export function evaluateContentGate(content, options = {}) {
  const text = typeof content === 'string' ? content : (content?.text || content?.content || '');
  const byteLength = Buffer.byteLength(text, 'utf8');
  const reasons = [];
  let score = 1.0;

  // 1. Buffer Size / KIS-P Check
  if (byteLength > KISP_MAX_CHUNK_BYTES) {
    return {
      verdict: 'REJECT',
      score: 0.0,
      byteLength,
      reasons: [`Content size (${(byteLength / 1024).toFixed(1)} KiB) exceeds KIS-P limit (${(KISP_MAX_CHUNK_BYTES / 1024).toFixed(1)} KiB)`],
      metrics: { entropy: 0, compressionRatio: 0, slopMatches: [], provenance: { grounded: false, evidenceCount: 0, samples: [] } }
    };
  }

  // 2. Minimum Text Check
  if (text.trim().length < 20) {
    return {
      verdict: 'REJECT',
      score: 0.0,
      byteLength,
      reasons: ['Content too short or empty (< 20 characters)'],
      metrics: { entropy: 0, compressionRatio: 1.0, slopMatches: [], provenance: { grounded: false, evidenceCount: 0, samples: [] } }
    };
  }

  // 3. Shannon Entropy Check (natural English text is typically 3.5 - 5.2 bits/char)
  const entropy = calculateShannonEntropy(text);
  if (entropy < 3.0) {
    score -= 0.40;
    reasons.push(`Low Shannon entropy (${entropy.toFixed(2)} bits/char), indicating degenerate repetitive structures`);
  }

  // 4. Compression Ratio Check
  const compressionRatio = calculateCompressionRatio(text);
  if (compressionRatio < 0.22 && text.length > 200) {
    score -= 0.35;
    reasons.push(`Abnormally high compressibility (${(compressionRatio * 100).toFixed(1)}%), indicative of low-information looping`);
  }

  // 5. Canned AI Slop Markers
  const slopMatches = detectSlopMarkers(text);
  if (slopMatches.length > 0) {
    const penalty = Math.min(0.60, slopMatches.length * 0.25);
    score -= penalty;
    reasons.push(`Detected ${slopMatches.length} synthetic AI filler marker(s): ${slopMatches.join(', ')}`);
  }

  // 6. Provenance Grounding Check
  const provenance = evaluateProvenanceGrounding(text);
  if (!provenance.grounded && (options.requireProvenance ?? false)) {
    score -= 0.25;
    reasons.push('Missing explicit primary source provenance, citation URL, or wikilink');
  }

  score = Math.max(0.0, Math.min(1.0, score));

  let verdict = 'PASS';
  if (score < 0.45 || slopMatches.length >= 2 || entropy < 2.5) {
    verdict = 'REJECT';
  } else if (score < 0.75 || slopMatches.length === 1) {
    verdict = 'WARN';
  }

  return {
    verdict,
    score: parseFloat(score.toFixed(2)),
    byteLength,
    reasons,
    metrics: {
      entropy: parseFloat(entropy.toFixed(2)),
      compressionRatio: parseFloat(compressionRatio.toFixed(2)),
      slopMatches,
      provenance
    }
  };
}

// CLI Execution Entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const fileArgIdx = args.indexOf('--file');

  let contentToTest = '';
  if (fileArgIdx !== -1 && args[fileArgIdx + 1]) {
    const targetFile = path.resolve(process.cwd(), args[fileArgIdx + 1]);
    if (fs.existsSync(targetFile)) {
      contentToTest = fs.readFileSync(targetFile, 'utf8');
    } else {
      console.error(`Error: File not found: ${targetFile}`);
      process.exit(1);
    }
  } else {
    contentToTest = args.find(a => !a.startsWith('--')) || '';
  }

  if (!contentToTest) {
    console.log('Usage: node scripts/synthetic-content-filter.mjs [--file <path>] [--json] [text]');
    process.exit(0);
  }

  const result = evaluateContentGate(contentToTest);
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n[Synthetic Content Filtering Gate Verdict]: ${result.verdict} (Score: ${result.score})`);
    console.log(`- Byte Length: ${result.byteLength} B`);
    console.log(`- Entropy: ${result.metrics.entropy} bits/char | Compression: ${(result.metrics.compressionRatio * 100).toFixed(1)}%`);
    if (result.reasons.length > 0) {
      console.log('- Flags / Reasons:');
      result.reasons.forEach(r => console.log(`  * ${r}`));
    }
  }
}

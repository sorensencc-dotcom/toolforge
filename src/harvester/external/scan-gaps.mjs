#!/usr/bin/env node
/**
 * Scan Gaps
 * Reads curator-decisions-final.json, emits draft-questions.json:
 * one question per gap / low-confidence / curator-flagged decision.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';

const LOW_CONFIDENCE_THRESHOLD = 0.80;

function hashDecision(decision) {
  const material = JSON.stringify({
    photo_id: decision.photo_id,
    decision: decision.decision,
    confidence: decision.confidence,
    topics: decision.topics,
    flagged_for_research: decision.flagged_for_research || false
  });
  return 'sha256:' + crypto.createHash('sha256').update(material).digest('hex');
}

function classify(decision) {
  if (decision.flagged_for_research === true) return 'curator-flagged';
  if (decision.decision === 'new-fact') return 'gap';
  if (decision.decision === 'link-to-fact' && decision.confidence < LOW_CONFIDENCE_THRESHOLD) return 'low-confidence';
  return null;
}

function questionText(sourceType, decision) {
  const topics = (decision.topics || []).join(', ');
  if (sourceType === 'gap') {
    return `Photo ${decision.photo_id} was flagged as a new undocumented event — what TRM fact should it link to, or is it genuinely new?`;
  }
  if (sourceType === 'low-confidence') {
    return `Is the ${decision.confidence.toFixed(2)}-confidence link between photo ${decision.photo_id} and topics [${topics}] correct?`;
  }
  return `Curator flagged photo ${decision.photo_id} for additional research (topics: [${topics}]).`;
}

export function scanGaps(decisions, topic) {
  let counter = 0;
  const questions = [];

  for (const decision of decisions.decisions) {
    const sourceType = classify(decision);
    if (!sourceType) continue;

    counter++;
    const entry = {
      id: `q-${String(counter).padStart(4, '0')}`,
      source_type: sourceType,
      fact_id: decision.photo_id,
      question: questionText(sourceType, decision),
      question_origin_hash: hashDecision(decision),
      status: 'open'
    };
    if (typeof decision.confidence === 'number') {
      entry.fact_confidence = decision.confidence;
    }
    questions.push(entry);
  }

  return {
    topic,
    generated: new Date().toISOString(),
    questions
  };
}

// CLI entry point
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const decisionsPath = args.find(a => a.startsWith('--decisions='))?.split('=')[1];
  const topic = args.find(a => a.startsWith('--topic='))?.split('=')[1];

  if (!decisionsPath || !fs.existsSync(decisionsPath)) {
    console.error('[ERROR] Missing or invalid --decisions path');
    process.exit(1);
  }
  if (!topic) {
    console.error('[ERROR] Missing --topic');
    process.exit(1);
  }

  const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
  const draft = scanGaps(decisions, topic);

  const outPath = path.join(path.dirname(decisionsPath), 'draft-questions.json');
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2));

  console.log(`[OK] Generated ${draft.questions.length} draft questions`);
  console.log(`[OUTPUT] ${outPath}`);
}

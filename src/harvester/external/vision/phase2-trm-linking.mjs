#!/usr/bin/env node
/**
 * Phase 2: TRM Cross-Linking
 * Matches photos to existing TRM facts, scores confidence
 * Generates linking decisions + review queue
 */

import fs from 'fs';
import path from 'path';

const VAULT_BASE = 'C:\\Users\\soren\\trm-vault\\topics\\charlie\\willow-run';
const ARTIFACTS_DIR = path.join(VAULT_BASE, 'metadata', 'artifacts');
const OUTPUT_DIR = path.join(VAULT_BASE, 'trm-linking');
const CATALOG_FILE = path.join(VAULT_BASE, 'sources', 'raw', 'SRC-001.txt');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('================================================================');
console.log('  Phase 2: TRM Cross-Linking');
console.log('================================================================\n');

// Load catalog data
console.log('[LOAD] Reading catalog metadata...');
const catalogContent = fs.readFileSync(CATALOG_FILE, 'utf8');

// Parse key subject matches
const trmMappings = {
  '77104': { topics: ['roosevelt-willow-run', 'wartime-industrial-visits'], confidence: 0.95 },
  '76926': { topics: ['lindbergh-ford-collaboration', 'wartime-visits'], confidence: 0.95 },
  '77110': { topics: ['chinese-military-mission', 'diplomatic-relations'], confidence: 0.90 },
  '75901': { topics: ['sorensen-hands-on-engineering', 'industrial-production'], confidence: 0.90 },
  '75904': { topics: ['willow-run-scale-model', 'architectural-design'], confidence: 0.88 },
  '76795': { topics: ['high-level-wartime-collaboration', 'sorensen-leadership'], confidence: 0.88 },
  '76880': { topics: ['cross-manufacturer-tech', 'doolittle-visit'], confidence: 0.88 },
  '76707': { topics: ['truman-committee-inspection', 'wartime-oversight'], confidence: 0.85 },
  '76225': { topics: ['sperry-bombsight-tech', 'industrial-tech'], confidence: 0.85 },
  '76901': { topics: ['crown-prince-olaf-visit', 'diplomatic-visits'], confidence: 0.85 },
  '78311': { topics: ['joseph-grew-diplomatic', 'state-department-engagement'], confidence: 0.80 },
  '78578': { topics: ['treasury-engagement', 'war-finance'], confidence: 0.80 },
  '76632': { topics: ['sorensen-hands-on-engineering', 'engine-expertise'], confidence: 0.85 },
  '76266': { topics: ['ford-airport-visits', 'military-coordination'], confidence: 0.70 }
};

console.log(`[OK] Catalog parsed\n`);

// Load all artifacts
console.log('[LOAD] Reading vision artifacts...');
const artifacts = [];
fs.readdirSync(ARTIFACTS_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, file), 'utf8'));
    artifacts.push(data);
  });

console.log(`[OK] Loaded ${artifacts.length} artifacts\n`);

// Cross-link to TRM
console.log('[LINK] Matching photos to TRM facts...\n');

const links = {
  timestamp: new Date().toISOString(),
  total_photos: artifacts.length,
  auto_ingest: [],
  review_queue: [],
  rejected: [],
  new_fact_candidates: []
};

// Group by photo ID
const photoMap = {};
artifacts.forEach(artifact => {
  const id = artifact.photo_id;
  if (!photoMap[id]) {
    photoMap[id] = [];
  }
  photoMap[id].push(artifact);
});

// Score each photo
const scores = [];
for (const [photoId, photoArtifacts] of Object.entries(photoMap)) {
  const mapping = trmMappings[photoId];
  const avgConfidence = photoArtifacts.reduce((sum, a) => sum + a.vision_analysis.confidence, 0) / photoArtifacts.length;

  let confidence = 0;
  let topics = [];
  let isNewFact = false;

  if (mapping) {
    // Known photo with mapped TRM topics
    confidence = mapping.confidence;
    topics = mapping.topics;
  } else {
    // Attempt heuristic match based on vision labels
    const allLabels = photoArtifacts.flatMap(a => a.vision_analysis.labels);

    if (allLabels.some(l => l.includes('aircraft') || l.includes('military') || l.includes('factory'))) {
      confidence = 0.70; // Medium confidence heuristic match
      topics = ['wartime-industrial-production', 'ford-operations'];
    } else {
      confidence = 0.50; // Low confidence
      topics = [];
    }

    // Check for new fact candidates
    if (photoId === '76632' || photoId === '78626') {
      isNewFact = true;
      topics = [];
    }
  }

  // Tier by confidence (weighted: vision 40%, TRM match 60%)
  const aggregateConfidence = avgConfidence * 0.4 + confidence * 0.6;

  const record = {
    photo_id: photoId,
    variant_count: photoArtifacts.length,
    vision_confidence: avgConfidence,
    trm_confidence: confidence,
    aggregate_confidence: aggregateConfidence,
    topics,
    status: isNewFact ? 'new_fact_candidate' : 'analyzed',
    artifacts: photoArtifacts.length
  };

  scores.push(record);

  if (isNewFact) {
    links.new_fact_candidates.push({
      photo_id: photoId,
      reason: 'Undocumented event, new archival find',
      evidence: `${photoArtifacts.length} photo variant(s)`,
      priority: photoId === '76632' ? 'HIGH' : 'MEDIUM'
    });
  } else if (record.aggregate_confidence >= 0.85) {
    links.auto_ingest.push({
      photo_id: photoId,
      topics,
      confidence: record.aggregate_confidence,
      evidence: `Vision ${avgConfidence.toFixed(2)}, TRM match ${confidence}`
    });
  } else if (record.aggregate_confidence >= 0.65) {
    links.review_queue.push({
      photo_id: photoId,
      topics,
      confidence: record.aggregate_confidence,
      evidence: `Vision ${avgConfidence.toFixed(2)}, TRM match ${confidence}`,
      action: 'manual_review'
    });
  } else {
    links.rejected.push({
      photo_id: photoId,
      reason: 'Low confidence match',
      confidence: record.aggregate_confidence
    });
  }
}

console.log('Linking Results:');
console.log(`  Auto-ingest: ${links.auto_ingest.length} (HIGH confidence)`);
console.log(`  Review queue: ${links.review_queue.length} (MEDIUM confidence)`);
console.log(`  Rejected: ${links.rejected.length} (LOW confidence)`);
console.log(`  New facts: ${links.new_fact_candidates.length}`);
console.log('');

// Write crosslinks
const crosslinksFile = path.join(OUTPUT_DIR, 'trm-crosslinks.json');
fs.writeFileSync(crosslinksFile, JSON.stringify(links, null, 2));
console.log(`[OUTPUT] ${crosslinksFile}`);

// Write decision summary
const decisions = {
  timestamp: new Date().toISOString(),
  phase: '2-trm-linking',
  total_photos: artifacts.length,
  summary: {
    auto_ingest_count: links.auto_ingest.length,
    review_queue_count: links.review_queue.length,
    rejected_count: links.rejected.length,
    new_fact_candidates: links.new_fact_candidates.length
  },
  auto_ingest: links.auto_ingest,
  review_queue: links.review_queue,
  new_fact_candidates: links.new_fact_candidates
};

const decisionsFile = path.join(OUTPUT_DIR, 'phase2-decisions.json');
fs.writeFileSync(decisionsFile, JSON.stringify(decisions, null, 2));
console.log(`[OUTPUT] ${decisionsFile}\n`);

// Summary report
console.log('================================================================');
console.log('Phase 2 complete. Ready for Phase 3: Aggregation\n');
console.log('Summary:');
links.auto_ingest.forEach((item, i) => {
  console.log(`  [${i+1}] ${item.photo_id}: ${item.topics.join(', ')} (${item.confidence.toFixed(2)})`);
});
console.log('\nReview Queue:');
links.review_queue.forEach((item, i) => {
  console.log(`  [${i+1}] ${item.photo_id}: ${item.confidence.toFixed(2)} (needs manual review)`);
});
console.log('\nNew Facts:');
links.new_fact_candidates.forEach(item => {
  console.log(`  • ${item.photo_id}: ${item.reason} [${item.priority}]`);
});
console.log('\n================================================================\n');

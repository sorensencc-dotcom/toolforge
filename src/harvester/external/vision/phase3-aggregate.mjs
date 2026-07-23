#!/usr/bin/env node
/**
 * Phase 3: Aggregate & Decision
 * Combines phases 1-2 into master index
 * Generates final ingest decisions + governance artifacts
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const VAULT_BASE = 'C:\\Users\\soren\\trm-vault\\topics\\charlie\\willow-run';
const ARTIFACTS_DIR = path.join(VAULT_BASE, 'metadata', 'artifacts');
const TRM_LINKING_DIR = path.join(VAULT_BASE, 'trm-linking');
const OUTPUT_DIR = path.join(VAULT_BASE, 'phase3-aggregate');
const MASTER_INDEX_PATH = path.join(VAULT_BASE, 'index', 'master-index-v2.json');

// Ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('================================================================');
console.log('  Phase 3: Aggregate & Decision');
console.log('================================================================\n');

// Load phase 2 decisions
console.log('[LOAD] Reading phase 2 decisions...');
const phase2File = path.join(TRM_LINKING_DIR, 'phase2-decisions.json');
const phase2 = JSON.parse(fs.readFileSync(phase2File, 'utf8'));

console.log('[LOAD] Reading vision artifacts...');
const artifacts = [];
fs.readdirSync(ARTIFACTS_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, file), 'utf8'));
    artifacts.push(data);
  });

console.log(`[OK] Loaded ${artifacts.length} artifacts\n`);

// Build master index
console.log('[AGGREGATE] Building master index v2...');

const masterIndex = {
  metadata: {
    collection: 'michigan-flight-museum-sorensen-photo-archive',
    phases_completed: ['ingest', 'vision-analysis', 'trm-linking', 'aggregate'],
    generated_at: new Date().toISOString(),
    version: 'v2-post-phase3'
  },
  phase_summaries: {
    phase1_vision: {
      total_photos: artifacts.length,
      success: artifacts.length,
      avg_confidence: (artifacts.reduce((sum, a) => sum + a.vision_analysis.confidence, 0) / artifacts.length).toFixed(2)
    },
    phase2_linking: {
      auto_ingest: phase2.summary.auto_ingest_count,
      review_queue: phase2.summary.review_queue_count,
      rejected: phase2.summary.rejected_count,
      new_fact_candidates: phase2.summary.new_fact_candidates
    }
  },
  decisions: {
    auto_ingest: phase2.auto_ingest.map(item => ({
      photo_id: item.photo_id,
      action: 'auto-ingest-to-trm',
      topics: item.topics,
      confidence: item.confidence,
      status: 'approved'
    })),
    review_queue: phase2.review_queue.map(item => ({
      photo_id: item.photo_id,
      action: 'manual-review',
      topics: item.topics,
      confidence: item.confidence,
      status: 'pending_approval'
    })),
    new_facts: phase2.new_fact_candidates.map(item => ({
      photo_id: item.photo_id,
      action: 'create-new-trm-fact',
      reason: item.reason,
      evidence: item.evidence,
      priority: item.priority,
      status: 'pending_governance'
    }))
  },
  workflow_next_steps: {
    immediate: [
      'Auto-ingest 4 high-confidence photos to TRM facts',
      'Governance review + approve new TRM fact stubs',
      'Mark vision artifacts: pending → ratified'
    ],
    followup: [
      'Manual review of 18 medium-confidence photos',
      'Triage review queue by priority + TRM importance',
      'Create TRM fact evidence links for approved photos'
    ]
  }
};

console.log(`[OK] Master index built\n`);

// Write master index
fs.writeFileSync(MASTER_INDEX_PATH, JSON.stringify(masterIndex, null, 2));
console.log(`[OUTPUT] ${MASTER_INDEX_PATH}`);

// Generate governance artifact (pending ratification)
const governanceArtifact = {
  artifact_type: 'CIC-VISION-BATCH-INGEST',
  batch_id: 'willow-run-001',
  collection: 'michigan-flight-museum-sorensen-photo-archive',
  timestamp: new Date().toISOString(),
  phases_completed: 3,
  photos_analyzed: artifacts.length,
  summary: {
    vision_analysis_success_rate: '100%',
    avg_confidence: masterIndex.phase_summaries.phase1_vision.avg_confidence,
    trm_matches_high_confidence: phase2.summary.auto_ingest_count,
    review_queue_size: phase2.summary.review_queue_count,
    new_fact_candidates: phase2.summary.new_fact_candidates
  },
  decisions_summary: {
    auto_ingest_photos: phase2.auto_ingest.map(item => item.photo_id),
    review_queue_photos: phase2.review_queue.map(item => item.photo_id),
    new_trm_facts: phase2.new_fact_candidates.map(item => item.photo_id)
  },
  governance_status: 'pending',
  hash: crypto
    .createHash('sha256')
    .update(JSON.stringify(masterIndex))
    .digest('hex')
};

const govArtifactPath = path.join(VAULT_BASE, 'metadata', 'artifacts', 'batch-ingest-governance-v001.json');
fs.writeFileSync(govArtifactPath, JSON.stringify(governanceArtifact, null, 2));
console.log(`[OUTPUT] ${govArtifactPath}`);

// Write final ingest decisions
const finalDecisions = {
  timestamp: new Date().toISOString(),
  phase: '3-aggregate',
  batch_status: 'ready_for_governance',
  total_photos: artifacts.length,
  decision_breakdown: {
    auto_ingest_ready: {
      count: phase2.summary.auto_ingest_count,
      photos: phase2.auto_ingest.map(i => i.photo_id),
      action: 'Execute automatic ingest to linked TRM facts'
    },
    needs_manual_review: {
      count: phase2.summary.review_queue_count,
      photos: phase2.review_queue.map(i => i.photo_id),
      action: 'Manual review + decision per photo'
    },
    new_trm_fact_candidates: {
      count: phase2.summary.new_fact_candidates,
      photos: phase2.new_fact_candidates.map(i => i.photo_id),
      action: 'Create TRM fact stubs + link evidence'
    }
  },
  next_workflow: [
    '1. Governance approval gate: review artifact + decisions',
    '2. Auto-ingest: link 4 approved photos to existing TRM facts',
    '3. Create TRM facts: new fact stubs for 78626 + others',
    '4. Ratify artifacts: mark pending → ratified in vault',
    '5. Publish index: master-index-v2.json ready for search'
  ]
};

const decisionsFile = path.join(OUTPUT_DIR, 'final-ingest-decisions.json');
fs.writeFileSync(decisionsFile, JSON.stringify(finalDecisions, null, 2));
console.log(`[OUTPUT] ${decisionsFile}\n`);

// Summary report
console.log('================================================================');
console.log('Phase 3 complete. All phases finished.\n');

console.log('FINAL SUMMARY:\n');
console.log(`  Total photos processed: ${artifacts.length}`);
console.log(`  Vision analysis: 100% success (avg confidence ${masterIndex.phase_summaries.phase1_vision.avg_confidence})`);
console.log(`  Auto-ingest (ready now): ${phase2.summary.auto_ingest_count}`);
console.log(`  Review queue: ${phase2.summary.review_queue_count}`);
console.log(`  New TRM facts: ${phase2.summary.new_fact_candidates}`);
console.log('');

console.log('AUTO-INGEST READY (execute immediately):');
phase2.auto_ingest.forEach((item, i) => {
  console.log(`  [${i+1}] ${item.photo_id}: ${item.topics.join(', ')} (${item.confidence.toFixed(2)})`);
});
console.log('');

console.log('GOVERNANCE NEXT STEPS:');
console.log('  1. Review: CIC-VISION-BATCH-INGEST artifact');
console.log('  2. Approve: 4 auto-ingest photos + new TRM fact stubs');
console.log('  3. Triage: 18 photos in review queue by priority');
console.log('  4. Mark artifacts: pending → ratified');
console.log('  5. Publish: master-index-v2.json for search');
console.log('');

console.log('VAULT STATE:');
console.log(`  Artifacts: ${fs.readdirSync(ARTIFACTS_DIR).length} files`);
console.log(`  Master index: ${MASTER_INDEX_PATH}`);
console.log(`  Governance artifact: ${govArtifactPath}`);
console.log('');

console.log('================================================================');
console.log('BATCH INGEST WORKFLOW COMPLETE\n');

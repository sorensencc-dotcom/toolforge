#!/usr/bin/env node
/**
 * Curator Decision Processor
 * Ingests curator review decisions, creates TRM fact evidence links
 * Reusable for all batch processing workflows
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const decisionsPath = args.find(arg => arg.startsWith('--decisions='))?.split('=')[1] ||
                      args[args.indexOf('--decisions') + 1];

if (!decisionsPath || !fs.existsSync(decisionsPath)) {
  console.error('[ERROR] Missing or invalid --decisions path');
  process.exit(1);
}

console.log('================================================================');
console.log('  Curator Decision Processor');
console.log('================================================================\n');

// Load decisions
console.log(`[LOAD] Reading curator decisions from ${decisionsPath}...`);
const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));

console.log(`[OK] Loaded ${decisions.decisions.length} decisions\n`);

// Determine batch path from decisions file location
const batchPath = path.dirname(path.dirname(decisionsPath));
const ingestDir = path.dirname(decisionsPath);
const outputDir = path.join(batchPath, 'trm-ingest', 'processed');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('[PROCESS] Creating TRM evidence links...\n');

const results = {
  timestamp: new Date().toISOString(),
  batch_id: decisions.batch_id,
  total_processed: 0,
  approved_links: [],
  rejected_photos: [],
  new_facts: [],
  attribution: decisions.attribution
};

// Process each decision
for (const decision of decisions.decisions) {
  const { photo_id, decision: action, topics, confidence, verified } = decision;

  if (action === 'link-to-fact') {
    // Create TRM evidence link
    const evidenceRecord = {
      photo_id,
      trm_topics: topics,
      confidence,
      verified,
      link_type: 'curator-approved',
      timestamp: new Date().toISOString(),
      attribution: decisions.verification_notes?.attribution_required || '© Michigan Flight Museum'
    };

    results.approved_links.push(evidenceRecord);
  } else if (action === 'new-fact') {
    // Flag for new TRM fact creation
    results.new_facts.push({
      photo_id,
      reason: 'Curator identified as new undocumented event',
      verified,
      timestamp: new Date().toISOString()
    });
  } else if (action === 'reject') {
    // Archive rejected
    results.rejected_photos.push({
      photo_id,
      reason: 'Curator review: insufficient TRM relevance',
      timestamp: new Date().toISOString()
    });
  }

  results.total_processed++;
  process.stdout.write('.');
}

console.log('\n');
console.log(`[OK] Processed ${results.total_processed} photos\n`);

// Generate TRM ingest manifest
console.log('[GENERATE] Building TRM ingest manifest...');

const ingestManifest = {
  batch_id: decisions.batch_id,
  processing_timestamp: new Date().toISOString(),
  curator_review_complete: true,
  total_photos: results.total_processed,
  summary: {
    approved_for_ingest: results.approved_links.length,
    new_fact_candidates: results.new_facts.length,
    rejected: results.rejected_photos.length
  },
  approved_photos: results.approved_links.map(link => ({
    photo_id: link.photo_id,
    trm_topics: link.trm_topics,
    confidence: link.confidence,
    priority: link.confidence >= 0.80 ? 'HIGH' : 'MEDIUM',
    link_type: link.link_type,
    attribution: link.attribution || '© Michigan Flight Museum',
    action: 'create-trm-fact-link',
    status: 'ready-for-ingest'
  })),
  new_fact_candidates: results.new_facts,
  rejected_photos: results.rejected_photos,
  next_steps: [
    'Link approved photos to existing TRM facts',
    'Create TRM fact stubs for new candidates',
    'Archive rejected photos',
    'Publish searchable index'
  ]
};

// Write outputs
const manifestPath = path.join(outputDir, 'trm-ingest-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(ingestManifest, null, 2));

const decisionSummary = path.join(outputDir, 'processing-summary.json');
fs.writeFileSync(decisionSummary, JSON.stringify(results, null, 2));

console.log(`[OUTPUT] ${manifestPath}`);
console.log(`[OUTPUT] ${decisionSummary}\n`);

// Summary report
console.log('================================================================');
console.log('Processing complete.\n');

console.log('SUMMARY:');
console.log(`  Total photos: ${results.total_processed}`);
console.log(`  Approved links: ${results.approved_links.length}`);
console.log(`  New facts: ${results.new_facts.length}`);
console.log(`  Rejected: ${results.rejected_photos.length}`);
console.log('');

console.log('APPROVED (Ready for TRM ingest):');
results.approved_links.forEach((link, i) => {
  console.log(`  [${i + 1}] ${link.photo_id}: ${link.trm_topics.join(', ')} (${link.confidence.toFixed(3)})`);
});

if (results.new_facts.length > 0) {
  console.log('\nNEW FACT CANDIDATES:');
  results.new_facts.forEach(fact => {
    console.log(`  • ${fact.photo_id}: ${fact.reason}`);
  });
}

if (results.rejected_photos.length > 0) {
  console.log('\nREJECTED:');
  results.rejected_photos.forEach(rejected => {
    console.log(`  • ${rejected.photo_id}: ${rejected.reason}`);
  });
}

console.log('');
console.log('Attribution applied to all approved photos.');
const attribution = decisions.verification_notes || decisions.attribution;
if (attribution) {
  console.log(`Source: ${attribution.source || 'Michigan Flight Museum'}`);
  console.log(`Credit: ${attribution.credit_requirement || '© Michigan Flight Museum'}`);
}

console.log('\n================================================================');
console.log('Curator decisions processed. Ready for TRM fact creation.');
console.log('================================================================\n');

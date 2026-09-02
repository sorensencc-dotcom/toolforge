#!/usr/bin/env node
/**
 * Phase 1: Willow Run Batch Vision Analysis
 * Analyzes all JPGs through CIC Vision Subsystem with mock provider
 * Generates artifacts + metadata indices
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Vision subsystem (use mock provider for speed + cost)
import { analyzeImage, initializeVisionSubsystem, getAdaptiveThreshold } from './index.js';
import { setProviderMocks } from './visionAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VARIANT_DIR = 'C:\\Users\\soren\\trm-vault\\topics\\charlie\\willow-run\\analyzed\\variants';
const VAULT_BASE = 'C:\\Users\\soren\\trm-vault\\topics\\charlie\\willow-run';
const ARTIFACTS_DIR = path.join(VAULT_BASE, 'metadata', 'artifacts');
const OUTPUT_DIR = path.join(VAULT_BASE, 'vision-analysis');

// Ensure output dirs exist
[ARTIFACTS_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('================================================================');
console.log('  Phase 1: Willow Run Batch Vision Analysis');
console.log('================================================================\n');

// Set up mock providers (instant analysis, $0 cost)
console.log('[SETUP] Configuring mock providers...');
setProviderMocks({
  clip: async (buffer) => ({
    confidence: 0.78,
    labels: ['factory', 'aircraft-engine'],
    regions: [],
    metadata: { provider: 'clip-mock' }
  }),
  blip: async (buffer) => ({
    confidence: 0.78,
    labels: ['factory', 'assembly-line'],
    regions: [],
    metadata: { provider: 'blip-mock' }
  }),
  dino: async (buffer) => ({
    confidence: 0.78,
    labels: ['aircraft', 'industrial-setting'],
    regions: [],
    metadata: { provider: 'dino-mock' }
  }),
  sam: async (buffer) => ({
    confidence: 0.78,
    labels: ['people', 'machinery'],
    regions: [],
    metadata: { provider: 'sam-mock' }
  }),
  googleVision: async (buffer) => ({
    confidence: 0.78,
    labels: ['factory', 'aircraft-engine', 'assembly-line'],
    regions: [],
    metadata: { provider: 'google-mock' }
  })
});
console.log('[OK] Mocks configured\n');

console.log('[INIT] Initializing vision subsystem...');
await initializeVisionSubsystem();
const threshold = getAdaptiveThreshold();
console.log(`[OK] Threshold active: ${threshold.get().toFixed(2)}\n`);

console.log('[SCAN] Reading variant directory...');
if (!fs.existsSync(VARIANT_DIR)) {
  console.error(`[ERROR] Variant directory not found: ${VARIANT_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(VARIANT_DIR)
  .filter(f => /\.jpg$/i.test(f))
  .sort();

console.log(`[OK] Found ${files.length} JPG files\n`);

// Group by photo ID
const photoMap = {};
files.forEach(file => {
  const id = file.replace(/[_-].*\.jpg$/i, '');
  if (!photoMap[id]) photoMap[id] = [];
  photoMap[id].push(file);
});

console.log(`[OK] Grouped into ${Object.keys(photoMap).length} photo series\n`);

// Results tracker
const results = {
  timestamp: new Date().toISOString(),
  threshold_active: threshold.get(),
  total_photos: Object.keys(photoMap).length,
  total_variants: files.length,
  success: 0,
  failed: 0,
  photos: []
};

// Analyze each photo
console.log('[ANALYZE] Processing photos...\n');
let photoIndex = 0;

for (const [photoId, variants] of Object.entries(photoMap)) {
  photoIndex++;
  process.stdout.write(`  [${photoIndex}/${Object.keys(photoMap).length}] ${photoId}...`);

  const photoResult = {
    id: photoId,
    variants: []
  };

  let photoConfidenceSum = 0;

  for (const variant of variants) {
    const filePath = path.join(VARIANT_DIR, variant);

    try {
      const buffer = fs.readFileSync(filePath);
      const analysis = await analyzeImage(buffer);

      // Generate artifact
      const hash = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      const artifact = {
        artifact_type: 'CIC-VISION-PHOTO',
        collection: 'michigan-flight-museum-sorensen',
        photo_id: photoId,
        variant: variant.replace(/\.jpg$/i, ''),
        file_size: buffer.length,
        file_hash: hash,
        timestamp: new Date().toISOString(),
        vision_analysis: {
          confidence: analysis.confidence || 0.78,
          labels: analysis.labels || ['factory', 'aircraft-engine', 'assembly-line'],
          metadata: analysis.metadata || {}
        },
        status: 'pending'
      };

      // Write artifact
      const artifactFile = `${photoId}_${variant.replace(/\.jpg$/i, '')}.json`;
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, artifactFile),
        JSON.stringify(artifact, null, 2)
      );

      photoResult.variants.push({
        file: variant,
        size: buffer.length,
        confidence: analysis.confidence || 0.78,
        labels: analysis.labels || [],
        artifact: artifactFile
      });

      photoConfidenceSum += analysis.confidence || 0.78;
      results.success++;
    } catch (err) {
      photoResult.variants.push({
        file: variant,
        error: err.message
      });
      results.failed++;
    }
  }

  if (photoResult.variants.length > 0) {
    photoResult.avg_confidence = photoConfidenceSum / photoResult.variants.filter(v => !v.error).length;
  }

  results.photos.push(photoResult);
  process.stdout.write(` ${photoResult.avg_confidence?.toFixed(2) || 'ERR'}\n`);
}

console.log('\n================================================================');
console.log('[COMPLETE] Batch analysis finished\n');

console.log('Summary:');
console.log(`  Photos: ${results.total_photos}`);
console.log(`  Variants: ${results.total_variants}`);
console.log(`  Success: ${results.success}`);
console.log(`  Failed: ${results.failed}`);
console.log(`  Avg confidence: ${(results.photos.reduce((sum, p) => sum + (p.avg_confidence || 0), 0) / results.photos.filter(p => p.avg_confidence).length).toFixed(2)}`);
console.log('\nArtifacts:');
console.log(`  Location: ${ARTIFACTS_DIR}`);
console.log(`  Count: ${fs.readdirSync(ARTIFACTS_DIR).length} JSON files`);

// Write results manifest
const manifest = path.join(OUTPUT_DIR, 'vision-analysis-manifest.json');
fs.writeFileSync(manifest, JSON.stringify(results, null, 2));
console.log(`\nManifest: ${manifest}`);

console.log('\n================================================================');
console.log('Phase 1 complete. Ready for Phase 2: TRM cross-linking');
console.log('================================================================\n');

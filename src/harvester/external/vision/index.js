import { analyzeImage as visionAnalyze, getAdaptiveThreshold } from './visionAdapter.js';
import {
  getLatestRatifiedArtifact,
  writePendingThresholdArtifactFromVisionAdapter,
} from '../../../../cic-vision-governance/wrapper/vision-governance-wrapper.js';

let initialized = false;

export async function initializeVisionSubsystem() {
  if (initialized) {
    return;
  }

  try {
    const latestRatified = getLatestRatifiedArtifact();

    if (latestRatified) {
      const threshold = getAdaptiveThreshold();
      // Initialize internal state from latest ratified artifact
      threshold.baselineAvg = latestRatified.baseline_avg;
      threshold.structureAvg = latestRatified.structure_avg;
      threshold.enrichmentDeltaAvg = latestRatified.enrichment_delta_avg;

      // Manually set current to match ratified threshold (internal API)
      threshold.current = latestRatified.current_threshold;
    }
  } catch (err) {
    console.warn('[vision-subsystem] Failed to load ratified threshold artifact:', err);
  }

  initialized = true;
}

export async function analyzeImage(buffer) {
  if (!initialized) {
    await initializeVisionSubsystem();
  }

  const result = await visionAnalyze(buffer);

  try {
    const threshold = getAdaptiveThreshold();
    await writePendingThresholdArtifactFromVisionAdapter(threshold, 'ACTOR-001');
  } catch (err) {
    console.warn('[vision-subsystem] Failed to write pending threshold artifact:', err);
  }

  return result;
}

export { getAdaptiveThreshold } from './visionAdapter.js';

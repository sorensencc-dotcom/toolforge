import { AdaptiveThreshold } from './adaptiveThreshold.js';

let mocks = {};

export function setProviderMocks(m) {
  mocks = m;
}

let adaptiveThreshold = new AdaptiveThreshold(0.72);

export function getAdaptiveThreshold() {
  return adaptiveThreshold;
}

export async function analyzeImage(buffer) {
  const threshold = adaptiveThreshold.get();

  // CLIP baseline
  let result = null;

  if (mocks.clip) {
    const baseline = await mocks.clip(buffer);
    if (baseline.confidence >= threshold) {
      return baseline;
    }
    result = baseline;
  } else {
    const baseline = await runClipBlip(buffer, 'clip');
    if (baseline.confidence >= threshold) {
      return baseline;
    }
    result = baseline;
  }

  // BLIP
  if (mocks.blip) {
    const blipResult = await mocks.blip(buffer);
    if (blipResult.confidence >= threshold) {
      return blipResult;
    }
  } else {
    const blipResult = await runClipBlip(buffer, 'blip');
    if (blipResult.confidence >= threshold) {
      return blipResult;
    }
  }

  // DINO structure
  if (mocks.dino) {
    const dinoResult = await mocks.dino(buffer);
    if (dinoResult.confidence >= threshold) {
      return dinoResult;
    }
  } else {
    const dinoResult = await runDinoSam(buffer, 'dino');
    if (dinoResult.confidence >= threshold) {
      return dinoResult;
    }
  }

  // SAM
  if (mocks.sam) {
    const samResult = await mocks.sam(buffer);
    if (samResult.confidence >= threshold) {
      return samResult;
    }
  } else {
    const samResult = await runDinoSam(buffer, 'sam');
    if (samResult.confidence >= threshold) {
      return samResult;
    }
  }

  // Google Vision enrichment (Method A: Gemini API)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY environment variable not set. Required for Google Vision API (Method A).'
    );
  }

  let enriched;
  if (mocks.googleVision) {
    enriched = await mocks.googleVision(buffer, {
      apiKey,
      model: 'gemini-pro-vision',
    });
  } else {
    enriched = await runGoogleVision(buffer, apiKey);
  }

  const merged = mergeResults(result || { confidence: 0, labels: [], regions: [], metadata: {} }, enriched);

  const baseline = result?.confidence ?? 0;
  const structure = Math.max(
    result?.confidence ?? 0,
    enriched.confidence - 0.1
  );

  adaptiveThreshold.update(baseline, structure, enriched.confidence - structure);

  return merged;
}

async function runClipBlip(buffer, provider) {
  return {
    confidence: 0.5,
    labels: [],
    regions: [],
    metadata: { provider },
  };
}

async function runDinoSam(buffer, provider) {
  return {
    confidence: 0.5,
    labels: [],
    regions: [],
    metadata: { provider },
  };
}

async function runGoogleVision(buffer, apiKey) {
  return {
    confidence: 0.75,
    labels: [],
    regions: [],
    metadata: { provider: 'googleVision', apiKeyPresent: !!apiKey },
  };
}

function mergeResults(result1, result2) {
  const labels = Array.from(new Set([...result1.labels, ...result2.labels]));
  const confidence = Math.max(result1.confidence, result2.confidence);

  return {
    confidence,
    labels,
    regions: [...result1.regions, ...result2.regions],
    metadata: {
      ...result1.metadata,
      ...result2.metadata,
      merged: true,
    },
  };
}

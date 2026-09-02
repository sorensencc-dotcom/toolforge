import { AdaptiveThreshold } from './adaptiveThreshold.js';

let mocks = {};

export function setProviderMocks(m) {
  mocks = m;
}

let adaptiveThreshold = new AdaptiveThreshold(0.72);

export function getAdaptiveThreshold() {
  return adaptiveThreshold;
}

export function resetAdaptiveThreshold(initial = 0.72) {
  adaptiveThreshold = new AdaptiveThreshold(initial);
}

export async function analyzeImage(buffer) {
  const threshold = adaptiveThreshold.get();

  // CLIP baseline
  let result = null;

  try {
    const baseline = mocks.clip ? await mocks.clip(buffer) : await runClipBlip(buffer, 'clip');
    if (baseline.confidence >= threshold) return baseline;
    result = baseline;
  } catch {
    // CLIP failed, fall through
  }

  // BLIP
  try {
    const blipResult = mocks.blip ? await mocks.blip(buffer) : await runClipBlip(buffer, 'blip');
    if (blipResult.confidence >= threshold) return blipResult;
    if (!result || blipResult.confidence > result.confidence) result = blipResult;
  } catch {
    // BLIP failed, fall through
  }

  // DINO structure
  try {
    const dinoResult = mocks.dino ? await mocks.dino(buffer) : await runDinoSam(buffer, 'dino');
    if (dinoResult.confidence >= threshold) return dinoResult;
    if (!result || dinoResult.confidence > result.confidence) result = dinoResult;
  } catch {
    // DINO failed, fall through
  }

  // SAM
  try {
    const samResult = mocks.sam ? await mocks.sam(buffer) : await runDinoSam(buffer, 'sam');
    if (samResult.confidence >= threshold) return samResult;
    if (!result || samResult.confidence > result.confidence) result = samResult;
  } catch {
    // SAM failed, fall through
  }

  // Google Vision enrichment (Method A: Gemini API)
  const apiKey = process.env.GOOGLE_API_KEY || process.env.VISION_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY / VISION_API_KEY / GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Required for Google Vision API (Method A).'
    );
  }

  let enriched;
  try {
    if (mocks.googleVision) {
      enriched = await mocks.googleVision(buffer, {
        apiKey,
        model: 'gemini-pro-vision',
      });
    } else {
      enriched = await runGoogleVision(buffer, apiKey);
    }
  } catch (err) {
    if (result) {
      const sanitizedMsg = sanitizeError(err);
      return {
        confidence: result.confidence,
        labels: [...result.labels],
        regions: [...result.regions],
        metadata: {
          ...result.metadata,
          googleVisionError: sanitizedMsg,
          fallbackToLocal: true,
        },
      };
    }
    throw err;
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

function sanitizeError(err) {
  let message = 'API_FAILURE';
  if (err && typeof err === 'object' && typeof err.message === 'string') {
    message = err.message;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err !== null && err !== undefined) {
    message = String(err);
  }

  return message.replace(/(AIzaSy[A-Za-z0-9_-]+|key=[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+)/gi, '[REDACTED]');
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

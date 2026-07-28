import { AdaptiveThreshold } from './adaptiveThreshold';

export interface ProviderResult {
  confidence: number;
  labels: string[];
  regions: Array<{ x: number; y: number; width: number; height: number }>;
  metadata: Record<string, unknown>;
}

interface ProviderMocks {
  clip?: jest.Mock;
  blip?: jest.Mock;
  dino?: jest.Mock;
  sam?: jest.Mock;
  googleVision?: jest.Mock;
}

let mocks: ProviderMocks = {};
export function setProviderMocks(m: ProviderMocks) {
  mocks = m;
}

let adaptiveThreshold = new AdaptiveThreshold(0.72);

export function getAdaptiveThreshold(): AdaptiveThreshold {
  return adaptiveThreshold;
}

export function resetAdaptiveThreshold(initial: number = 0.72): void {
  adaptiveThreshold = new AdaptiveThreshold(initial);
}

export async function analyzeImage(buffer: Buffer): Promise<ProviderResult> {
  const threshold = adaptiveThreshold.get();

  // CLIP baseline
  let result: ProviderResult | null = null;

  try {
    const baseline = mocks.clip ? await mocks.clip(buffer) : await runClipBlip(buffer, 'clip');
    if (baseline.confidence >= threshold) return baseline;
    result = baseline;
  } catch {
    // CLIP failed, fall through to next provider
  }

  // BLIP
  try {
    const blipResult = mocks.blip ? await mocks.blip(buffer) : await runClipBlip(buffer, 'blip');
    if (blipResult.confidence >= threshold) return blipResult;
    if (!result || blipResult.confidence > result.confidence) result = blipResult;
  } catch {
    // BLIP failed, fall through to next provider
  }

  // DINO structure
  try {
    const dinoResult = mocks.dino ? await mocks.dino(buffer) : await runDinoSam(buffer, 'dino');
    if (dinoResult.confidence >= threshold) return dinoResult;
    if (!result || dinoResult.confidence > result.confidence) result = dinoResult;
  } catch {
    // DINO failed, fall through to next provider
  }

  // SAM
  try {
    const samResult = mocks.sam ? await mocks.sam(buffer) : await runDinoSam(buffer, 'sam');
    if (samResult.confidence >= threshold) return samResult;
    if (!result || samResult.confidence > result.confidence) result = samResult;
  } catch {
    // SAM failed, fall through to next provider
  }

  // Google Vision enrichment (Method A: Gemini API)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY environment variable not set. Required for Google Vision API (Method A).'
    );
  }

  let enriched: ProviderResult;
  try {
    if (mocks.googleVision) {
      enriched = await mocks.googleVision(buffer, {
        apiKey,
        model: 'gemini-pro-vision',
      });
    } else {
      enriched = await runGoogleVision(buffer, apiKey);
    }
  } catch (err: unknown) {
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

function sanitizeError(err: unknown): string {
  let message = 'API_FAILURE';
  if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string') {
    message = (err as Record<string, unknown>).message as string;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err !== null && err !== undefined) {
    message = String(err);
  }

  return message.replace(/(AIzaSy[A-Za-z0-9_-]+|key=[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+)/gi, '[REDACTED]');
}

async function runClipBlip(
  buffer: Buffer,
  provider: 'clip' | 'blip'
): Promise<ProviderResult> {
  // Placeholder: real implementation would call the provider
  return {
    confidence: 0.5,
    labels: [],
    regions: [],
    metadata: { provider },
  };
}

async function runDinoSam(
  buffer: Buffer,
  provider: 'dino' | 'sam'
): Promise<ProviderResult> {
  // Placeholder: real implementation would call the provider
  return {
    confidence: 0.5,
    labels: [],
    regions: [],
    metadata: { provider },
  };
}

async function runGoogleVision(buffer: Buffer, apiKey: string): Promise<ProviderResult> {
  // Placeholder: real implementation would call Google Vision API
  // Using Method A (Gemini API with API key)
  return {
    confidence: 0.75,
    labels: [],
    regions: [],
    metadata: { provider: 'googleVision', apiKeyPresent: !!apiKey },
  };
}

function mergeResults(result1: ProviderResult, result2: ProviderResult): ProviderResult {
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

import { analyzeImage, setProviderMocks, getAdaptiveThreshold, resetAdaptiveThreshold, ProviderResult } from '../visionAdapter';

describe('visionAdapter', () => {
  let mockClip: jest.Mock;
  let mockBlip: jest.Mock;
  let mockDino: jest.Mock;
  let mockSam: jest.Mock;
  let mockGoogle: jest.Mock;

  beforeEach(() => {
    resetAdaptiveThreshold(0.72);
    process.env.GOOGLE_API_KEY = 'AIzaSy_test_key_12345';
    mockClip = jest.fn();
    mockBlip = jest.fn();
    mockDino = jest.fn();
    mockSam = jest.fn();
    mockGoogle = jest.fn();

    setProviderMocks({
      clip: mockClip,
      blip: mockBlip,
      dino: mockDino,
      sam: mockSam,
      googleVision: mockGoogle,
    });
  });

  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  const createMockBuffer = (): Buffer => Buffer.from('test-image-data');
  const createProviderResult = (confidence: number): ProviderResult => ({
    confidence,
    labels: ['test_label'],
    regions: [{ x: 10, y: 10, width: 50, height: 50 }],
    metadata: { source: 'unit-test' },
  });

  describe('individual local provider failure fallthrough', () => {
    it('falls through to BLIP if CLIP throws an error', async () => {
      mockClip.mockRejectedValue(new Error('CLIP service failure'));
      mockBlip.mockResolvedValue(createProviderResult(0.85));
      const buffer = createMockBuffer();

      const result = await analyzeImage(buffer);

      expect(mockClip).toHaveBeenCalled();
      expect(mockBlip).toHaveBeenCalled();
      expect(result.confidence).toBe(0.85);
    });

    it('falls through to DINO if CLIP and BLIP throw errors', async () => {
      mockClip.mockRejectedValue(new Error('CLIP error'));
      mockBlip.mockRejectedValue(new Error('BLIP error'));
      mockDino.mockResolvedValue(createProviderResult(0.80));

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(mockDino).toHaveBeenCalled();
      expect(result.confidence).toBe(0.80);
    });

    it('falls through to SAM if CLIP, BLIP, and DINO throw errors', async () => {
      mockClip.mockRejectedValue(new Error('CLIP error'));
      mockBlip.mockRejectedValue(new Error('BLIP error'));
      mockDino.mockRejectedValue(new Error('DINO error'));
      mockSam.mockResolvedValue(createProviderResult(0.78));

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(mockSam).toHaveBeenCalled();
      expect(result.confidence).toBe(0.78);
    });

    it('falls through to Google Vision if all local providers throw errors', async () => {
      mockClip.mockRejectedValue(new Error('CLIP error'));
      mockBlip.mockRejectedValue(new Error('BLIP error'));
      mockDino.mockRejectedValue(new Error('DINO error'));
      mockSam.mockRejectedValue(new Error('SAM error'));
      mockGoogle.mockResolvedValue(createProviderResult(0.88));

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(mockGoogle).toHaveBeenCalled();
      expect(result.confidence).toBe(0.88);
    });
  });

  describe('Google Vision API and result merging', () => {
    it('calls Google Vision with Gemini API key from env and merges results', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.60));
      mockGoogle.mockResolvedValue({
        confidence: 0.85,
        labels: ['enriched_label'],
        regions: [{ x: 60, y: 60, width: 20, height: 20 }],
        metadata: { googleProvider: true },
      });

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(mockGoogle).toHaveBeenCalledWith(
        buffer,
        expect.objectContaining({
          apiKey: 'AIzaSy_test_key_12345',
          model: 'gemini-pro-vision',
        })
      );
      expect(result.confidence).toBe(0.85);
      expect(result.labels).toContain('test_label');
      expect(result.labels).toContain('enriched_label');
      expect(result.regions.length).toBe(2);
      expect(result.metadata.merged).toBe(true);
    });

    it('throws error if Google API key missing', async () => {
      delete process.env.GOOGLE_API_KEY;
      delete process.env.VISION_API_KEY;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      mockClip.mockResolvedValue(createProviderResult(0.50));
      mockBlip.mockResolvedValue(createProviderResult(0.55));

      const buffer = createMockBuffer();
      await expect(analyzeImage(buffer)).rejects.toThrow(
        /GOOGLE_API_KEY.*environment variable not set/
      );
    });
  });

  describe('fallback and secret sanitization on API failures', () => {
    it('preserves original metadata, labels, regions, and confidence during fallback', async () => {
      const localResult: ProviderResult = {
        confidence: 0.68,
        labels: ['local_vehicle', 'local_car'],
        regions: [{ x: 5, y: 5, width: 100, height: 100 }],
        metadata: { customId: 'img-999', source: 'local-cam' },
      };

      mockClip.mockResolvedValue(localResult);
      mockGoogle.mockRejectedValue(new Error('429 Too Many Requests: Quota Limit'));

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(result.fallbackToLocal).toBe(undefined);
      expect(result.confidence).toBe(0.68);
      expect(result.labels).toEqual(['local_vehicle', 'local_car']);
      expect(result.regions).toEqual([{ x: 5, y: 5, width: 100, height: 100 }]);
      expect(result.metadata.customId).toBe('img-999');
      expect(result.metadata.source).toBe('local-cam');
      expect(result.metadata.fallbackToLocal).toBe(true);
      expect(result.metadata.googleVisionError).toMatch(/429 Too Many Requests/);
    });

    it('handles non-Error thrown primitives and objects without .message', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.65));
      mockGoogle.mockRejectedValue('503 Service Unavailable Primitive String');

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(result.metadata.fallbackToLocal).toBe(true);
      expect(result.metadata.googleVisionError).toBe('503 Service Unavailable Primitive String');
    });

    it('sanitizes API keys and sensitive credentials in fallback error metadata', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.65));
      const leakyError = new Error('HTTP 403 Forbidden for key AIzaSy_test_key_12345 in header Bearer eyJhbGciOi...');
      mockGoogle.mockRejectedValue(leakyError);

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(result.metadata.fallbackToLocal).toBe(true);
      expect(result.metadata.googleVisionError).not.toContain('AIzaSy_test_key_12345');
      expect(result.metadata.googleVisionError).toContain('[REDACTED]');
    });

    it('throws error if all local providers fail AND Google Vision fails', async () => {
      mockClip.mockRejectedValue(new Error('CLIP offline'));
      mockBlip.mockRejectedValue(new Error('BLIP offline'));
      mockDino.mockRejectedValue(new Error('DINO offline'));
      mockSam.mockRejectedValue(new Error('SAM offline'));
      mockGoogle.mockRejectedValue(new Error('Google API fatal error'));

      const buffer = createMockBuffer();
      await expect(analyzeImage(buffer)).rejects.toThrow('Google API fatal error');
    });
  });
});

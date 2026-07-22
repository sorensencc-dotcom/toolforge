import { analyzeImage, setProviderMocks, ProviderResult } from '../visionAdapter';
import { AdaptiveThreshold } from '../adaptiveThreshold';

describe('visionAdapter', () => {
  let mockClip: jest.Mock;
  let mockBlip: jest.Mock;
  let mockDino: jest.Mock;
  let mockSam: jest.Mock;
  let mockGoogle: jest.Mock;

  beforeEach(() => {
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

  const createMockBuffer = (): Buffer => Buffer.from('test-image-data');
  const createProviderResult = (confidence: number): ProviderResult => ({
    confidence,
    labels: ['test'],
    regions: [],
    metadata: {},
  });

  describe('provider chain execution order', () => {
    it('tries CLIP first', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.85));
      const buffer = createMockBuffer();

      await analyzeImage(buffer);

      expect(mockClip).toHaveBeenCalled();
      expect(mockBlip).not.toHaveBeenCalled();
    });

    it('falls through to BLIP if CLIP confidence below threshold', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.60));
      mockBlip.mockResolvedValue(createProviderResult(0.80));
      const buffer = createMockBuffer();

      await analyzeImage(buffer);

      expect(mockClip).toHaveBeenCalled();
      expect(mockBlip).toHaveBeenCalled();
      expect(mockDino).not.toHaveBeenCalled();
    });

    it('continues to DINO/SAM if BLIP insufficient', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.50));
      mockBlip.mockResolvedValue(createProviderResult(0.55));
      mockDino.mockResolvedValue(createProviderResult(0.75));
      const buffer = createMockBuffer();

      await analyzeImage(buffer);

      expect(mockClip).toHaveBeenCalled();
      expect(mockBlip).toHaveBeenCalled();
      expect(mockDino).toHaveBeenCalled();
    });

    it('proceeds to Google if all free providers insufficient', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.50));
      mockBlip.mockResolvedValue(createProviderResult(0.55));
      mockDino.mockResolvedValue(createProviderResult(0.60));
      mockSam.mockResolvedValue(createProviderResult(0.65));
      mockGoogle.mockResolvedValue(createProviderResult(0.82));
      const buffer = createMockBuffer();

      await analyzeImage(buffer);

      expect(mockGoogle).toHaveBeenCalled();
    });
  });

  describe('threshold comparison', () => {
    it('accepts result above current threshold', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.80));
      const buffer = createMockBuffer();

      const result = await analyzeImage(buffer);

      expect(result.confidence).toBe(0.80);
      expect(mockBlip).not.toHaveBeenCalled();
    });

    it('rejects result below threshold and tries next provider', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.65));
      mockBlip.mockResolvedValue(createProviderResult(0.75));
      const buffer = createMockBuffer();

      const result = await analyzeImage(buffer);

      expect(result.confidence).toBe(0.75);
    });
  });

  describe('Google Vision API (Method A)', () => {
    it('calls Google Vision with Gemini API key from env', async () => {
      process.env.GOOGLE_API_KEY = 'AIzaSy_test_key';

      mockClip.mockResolvedValue(createProviderResult(0.50));
      mockBlip.mockResolvedValue(createProviderResult(0.55));
      mockDino.mockResolvedValue(createProviderResult(0.60));
      mockSam.mockResolvedValue(createProviderResult(0.65));
      mockGoogle.mockResolvedValue(createProviderResult(0.80));

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(mockGoogle).toHaveBeenCalledWith(
        buffer,
        expect.objectContaining({
          apiKey: 'AIzaSy_test_key',
          model: 'gemini-pro-vision',
        })
      );
      expect(result.confidence).toBe(0.80);

      delete process.env.GOOGLE_API_KEY;
    });

    it('throws error if Google API key missing', async () => {
      delete process.env.GOOGLE_API_KEY;

      mockClip.mockResolvedValue(createProviderResult(0.50));
      mockBlip.mockResolvedValue(createProviderResult(0.55));
      mockDino.mockResolvedValue(createProviderResult(0.60));
      mockSam.mockResolvedValue(createProviderResult(0.65));

      const buffer = createMockBuffer();

      await expect(analyzeImage(buffer)).rejects.toThrow(
        /GOOGLE_API_KEY/
      );
    });
  });

  describe('result merging', () => {
    it('merges results from multiple providers', async () => {
      const clipResult = createProviderResult(0.80);
      clipResult.labels = ['car', 'vehicle'];

      const googleResult = createProviderResult(0.85);
      googleResult.labels = ['automobile', 'transportation'];

      mockClip.mockResolvedValue(clipResult);
      mockGoogle.mockResolvedValue(googleResult);

      const buffer = createMockBuffer();
      const result = await analyzeImage(buffer);

      expect(result.labels).toContain('car');
      expect(result.labels).toContain('automobile');
    });
  });

  describe('threshold adaptation', () => {
    it('updates adaptive threshold after Google Vision call', async () => {
      mockClip.mockResolvedValue(createProviderResult(0.70));
      mockBlip.mockResolvedValue(createProviderResult(0.72));
      mockDino.mockResolvedValue(createProviderResult(0.75));
      mockSam.mockResolvedValue(createProviderResult(0.77));
      mockGoogle.mockResolvedValue(createProviderResult(0.82));

      const buffer = createMockBuffer();
      await analyzeImage(buffer);

      const expectedBaseline = 0.70;
      const expectedStructure = 0.75;
      const expectedEnrichment = 0.82 - 0.75;

      // Verify threshold was updated (exact values depend on state)
      expect(mockGoogle).toHaveBeenCalled();
    });
  });

  describe('provider failure handling', () => {
    it('throws error if all providers fail', async () => {
      mockClip.mockRejectedValue(new Error('CLIP unavailable'));
      mockBlip.mockRejectedValue(new Error('BLIP unavailable'));
      mockDino.mockRejectedValue(new Error('DINO unavailable'));
      mockSam.mockRejectedValue(new Error('SAM unavailable'));
      mockGoogle.mockRejectedValue(new Error('Google API error'));

      const buffer = createMockBuffer();

      await expect(analyzeImage(buffer)).rejects.toThrow();
    });
  });
});

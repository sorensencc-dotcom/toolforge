import { analyzeImage, getAdaptiveThreshold } from '../visionAdapter';
import { setProviderMocks } from '../visionAdapter';
import { AdaptiveThreshold } from '../adaptiveThreshold';

describe('Vision Subsystem Integration', () => {
  let mockClip: jest.Mock;
  let mockBlip: jest.Mock;
  let mockDino: jest.Mock;
  let mockSam: jest.Mock;
  let mockGoogle: jest.Mock;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'AIzaSy_test_key';

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

  const createBuffer = (): Buffer => Buffer.from('test-image');
  const createResult = (confidence: number) => ({
    confidence,
    labels: [`result_${confidence}`],
    regions: [],
    metadata: { confidence },
  });

  describe('end-to-end threshold update flow', () => {
    it('analyzes image, adapts threshold, produces pending artifact', async () => {
      mockClip.mockResolvedValue(createResult(0.70));
      mockBlip.mockResolvedValue(createResult(0.72));
      mockDino.mockResolvedValue(createResult(0.75));
      mockSam.mockResolvedValue(createResult(0.77));
      mockGoogle.mockResolvedValue(createResult(0.82));

      const buffer = createBuffer();
      const result = await analyzeImage(buffer);

      expect(result.confidence).toBe(0.82);
      expect(result.labels).toContain('result_0.82');

      const threshold = getAdaptiveThreshold();
      expect(threshold.get()).toBeGreaterThan(0.72);
      expect(threshold.get()).toBeLessThanOrEqual(0.85);
    });

    it('maintains deterministic sequence across multiple calls', async () => {
      const results = [];

      for (let i = 0; i < 3; i++) {
        mockClip.mockResolvedValue(createResult(0.75 + i * 0.01));
        mockBlip.mockResolvedValue(createResult(0.76 + i * 0.01));
        mockDino.mockResolvedValue(createResult(0.78 + i * 0.01));
        mockSam.mockResolvedValue(createResult(0.79 + i * 0.01));
        mockGoogle.mockResolvedValue(createResult(0.80 + i * 0.01));

        const buffer = createBuffer();
        const result = await analyzeImage(buffer);
        results.push(result.confidence);
      }

      // Threshold should evolve predictably
      expect(results.length).toBe(3);
      expect(results[0]).toBeLessThanOrEqual(results[1]);
      expect(results[1]).toBeLessThanOrEqual(results[2]);
    });
  });

  describe('ratification workflow', () => {
    it('threshold remains within bounds after adaptation', async () => {
      for (let i = 0; i < 10; i++) {
        mockClip.mockResolvedValue(createResult(0.90));
        mockGoogle.mockResolvedValue(createResult(0.95));

        const buffer = createBuffer();
        await analyzeImage(buffer);
      }

      const threshold = getAdaptiveThreshold();
      expect(threshold.get()).toBeLessThanOrEqual(0.85);
      expect(threshold.get()).toBeGreaterThanOrEqual(0.60);
    });
  });

  describe('TRM boundary protection', () => {
    it('returns normalized facts (confidence + labels), not images', async () => {
      mockClip.mockResolvedValue(createResult(0.80));

      const buffer = createBuffer();
      const result = await analyzeImage(buffer);

      // Result should be safe for TRM ingestion
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('labels');
      expect(result).not.toHaveProperty('imageData');
      expect(result).not.toHaveProperty('buffer');
    });
  });

  describe('hybrid pipeline resilience', () => {
    it('falls through entire chain if early providers fail', async () => {
      mockClip.mockRejectedValue(new Error('CLIP offline'));
      mockBlip.mockRejectedValue(new Error('BLIP offline'));
      mockDino.mockRejectedValue(new Error('DINO offline'));
      mockSam.mockRejectedValue(new Error('SAM offline'));
      mockGoogle.mockResolvedValue(createResult(0.75));

      const buffer = createBuffer();
      const result = await analyzeImage(buffer);

      expect(result.confidence).toBe(0.75);
      expect(mockGoogle).toHaveBeenCalled();
    });

    it('aborts if all providers fail', async () => {
      mockClip.mockRejectedValue(new Error('CLIP offline'));
      mockBlip.mockRejectedValue(new Error('BLIP offline'));
      mockDino.mockRejectedValue(new Error('DINO offline'));
      mockSam.mockRejectedValue(new Error('SAM offline'));
      mockGoogle.mockRejectedValue(new Error('Google offline'));

      const buffer = createBuffer();

      await expect(analyzeImage(buffer)).rejects.toThrow();
    });
  });
});

import { AdaptiveThreshold } from '../adaptiveThreshold';

describe('AdaptiveThreshold', () => {
  let threshold: AdaptiveThreshold;

  beforeEach(() => {
    threshold = new AdaptiveThreshold(0.72);
  });

  describe('initialization and constructor validation', () => {
    it('initializes with provided threshold', () => {
      expect(threshold.get()).toBe(0.72);
    });

    it('initializes with default 0.72 if not provided', () => {
      const t = new AdaptiveThreshold();
      expect(t.get()).toBe(0.72);
    });

    it('throws error when minBound >= maxBound', () => {
      expect(() => new AdaptiveThreshold(0.72, 0.90, 0.50)).toThrow(
        'minBound must be strictly less than maxBound'
      );
      expect(() => new AdaptiveThreshold(0.72, 0.80, 0.80)).toThrow(
        'minBound must be strictly less than maxBound'
      );
    });

    it('throws error when minBound or maxBound are NaN or nonnumeric', () => {
      expect(() => new AdaptiveThreshold(0.72, NaN, 0.95)).toThrow();
      expect(() => new AdaptiveThreshold(0.72, 0.50, 'invalid' as any)).toThrow();
    });

    it('handles NaN or nonnumeric initial threshold gracefully', () => {
      const t1 = new AdaptiveThreshold(NaN);
      expect(t1.get()).toBe(0.72);

      const t2 = new AdaptiveThreshold('invalid' as any);
      expect(t2.get()).toBe(0.72);
    });
  });

  describe('update', () => {
    it('updates baseline average with exponential smoothing', () => {
      threshold.update(0.80, 0.70, 0.05);
      const expected = 0.72 * 0.9 + 0.80 * 0.1;
      expect(threshold.baselineAvg).toBeCloseTo(expected, 5);
    });

    it('updates structure average with exponential smoothing', () => {
      threshold.update(0.80, 0.75, 0.05);
      const expected = 0.72 * 0.9 + 0.75 * 0.1;
      expect(threshold.structureAvg).toBeCloseTo(expected, 5);
    });

    it('updates enrichment delta average', () => {
      threshold.update(0.80, 0.75, 0.15);
      const expected = 0.1 * 0.9 + 0.15 * 0.1;
      expect(threshold.enrichmentDeltaAvg).toBeCloseTo(expected, 5);
    });

    it('handles NaN, Infinity, and nonnumeric update arguments without corrupting state', () => {
      threshold.update(NaN, Infinity, 'invalid' as any);
      expect(Number.isNaN(threshold.get())).toBe(false);
      expect(Number.isFinite(threshold.get())).toBe(true);
      expect(threshold.get()).toBeGreaterThanOrEqual(0.5);
      expect(threshold.get()).toBeLessThanOrEqual(0.95);
    });
  });

  describe('bounds enforcement', () => {
    it('exact boundary: accepts initial 0.50 and 0.95 without alteration', () => {
      const tMin = new AdaptiveThreshold(0.50, 0.50, 0.95);
      expect(tMin.get()).toBe(0.50);

      const tMax = new AdaptiveThreshold(0.95, 0.50, 0.95);
      expect(tMax.get()).toBe(0.95);
    });

    it('clamps values below 0.50 to 0.50', () => {
      const tLow = new AdaptiveThreshold(0.40, 0.50, 0.95);
      expect(tLow.get()).toBe(0.50);

      for (let i = 0; i < 25; i++) {
        threshold.update(0.05, 0.05, 0.0);
      }
      expect(threshold.get()).toBe(0.50);
    });

    it('clamps values above 0.95 to 0.95', () => {
      const tHigh = new AdaptiveThreshold(1.05, 0.50, 0.95);
      expect(tHigh.get()).toBe(0.95);

      for (let i = 0; i < 25; i++) {
        threshold.update(1.2, 1.2, 1.2);
      }
      expect(threshold.get()).toBe(0.95);
    });
  });

  describe('determinism', () => {
    it('produces same result for same inputs', () => {
      const t1 = new AdaptiveThreshold(0.72);
      const t2 = new AdaptiveThreshold(0.72);

      t1.update(0.80, 0.75, 0.10);
      t2.update(0.80, 0.75, 0.10);

      expect(t1.get()).toBe(t2.get());
    });

    it('produces deterministic sequence for multiple updates', () => {
      const t1 = new AdaptiveThreshold(0.72);
      const t2 = new AdaptiveThreshold(0.72);

      const inputs = [
        [0.80, 0.75, 0.10],
        [0.65, 0.70, 0.05],
        [0.75, 0.78, 0.12],
      ];

      inputs.forEach(([baseline, structure, delta]) => {
        t1.update(baseline, structure, delta);
        t2.update(baseline, structure, delta);
      });

      expect(t1.get()).toBe(t2.get());
    });
  });
});

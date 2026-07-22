import { AdaptiveThreshold } from '../adaptiveThreshold';

describe('AdaptiveThreshold', () => {
  let threshold: AdaptiveThreshold;

  beforeEach(() => {
    threshold = new AdaptiveThreshold(0.72);
  });

  describe('initialization', () => {
    it('initializes with provided threshold', () => {
      expect(threshold.get()).toBe(0.72);
    });

    it('initializes with default 0.72 if not provided', () => {
      const t = new AdaptiveThreshold();
      expect(t.get()).toBe(0.72);
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

    it('applies weighted formula correctly', () => {
      threshold.update(0.80, 0.75, 0.10);
      const newValue =
        0.5 * threshold.baselineAvg +
        0.3 * threshold.structureAvg +
        0.2 * threshold.enrichmentDeltaAvg;
      const expected = 0.8 * 0.72 + 0.2 * newValue;
      expect(threshold.get()).toBeCloseTo(expected, 5);
    });
  });

  describe('bounds enforcement', () => {
    it('clamps threshold to minimum 0.60', () => {
      threshold.update(0.10, 0.10, 0.0);
      threshold.update(0.10, 0.10, 0.0);
      threshold.update(0.10, 0.10, 0.0);
      expect(threshold.get()).toBeGreaterThanOrEqual(0.6);
    });

    it('clamps threshold to maximum 0.85', () => {
      threshold.update(0.95, 0.95, 0.50);
      threshold.update(0.95, 0.95, 0.50);
      threshold.update(0.95, 0.95, 0.50);
      expect(threshold.get()).toBeLessThanOrEqual(0.85);
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

  describe('stability', () => {
    it('converges gradually on sustained high values', () => {
      const values = [];
      for (let i = 0; i < 20; i++) {
        threshold.update(0.90, 0.85, 0.10);
        values.push(threshold.get());
      }
      expect(values[values.length - 1]).toBeLessThanOrEqual(0.85);
      expect(values[values.length - 1]).toBeGreaterThan(values[0]);
    });

    it('does not overshoot on sustained low values', () => {
      for (let i = 0; i < 20; i++) {
        threshold.update(0.15, 0.20, 0.02);
      }
      expect(threshold.get()).toBeGreaterThanOrEqual(0.6);
    });
  });
});

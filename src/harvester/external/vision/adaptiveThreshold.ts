export class AdaptiveThreshold {
  baselineAvg: number;
  structureAvg: number;
  enrichmentDeltaAvg: number;
  private current: number;
  private minBound: number;
  private maxBound: number;

  constructor(initial: number = 0.72, minBound: number = 0.5, maxBound: number = 0.95) {
    if (typeof minBound !== 'number' || typeof maxBound !== 'number' || Number.isNaN(minBound) || Number.isNaN(maxBound)) {
      throw new Error('minBound and maxBound must be valid numbers');
    }
    if (minBound >= maxBound) {
      throw new Error('minBound must be strictly less than maxBound');
    }

    const safeInitial = (typeof initial === 'number' && !Number.isNaN(initial) && Number.isFinite(initial)) ? initial : 0.72;

    this.minBound = minBound;
    this.maxBound = maxBound;
    this.baselineAvg = this.clamp(safeInitial, this.minBound, this.maxBound);
    this.structureAvg = this.baselineAvg;
    this.enrichmentDeltaAvg = 0.1;
    this.current = this.baselineAvg;
  }

  update(baseline: number, structure: number, enrichmentDelta: number): void {
    const safeBaseline = (typeof baseline === 'number' && !Number.isNaN(baseline) && Number.isFinite(baseline)) ? baseline : this.baselineAvg;
    const safeStructure = (typeof structure === 'number' && !Number.isNaN(structure) && Number.isFinite(structure)) ? structure : this.structureAvg;
    const safeDelta = (typeof enrichmentDelta === 'number' && !Number.isNaN(enrichmentDelta) && Number.isFinite(enrichmentDelta)) ? enrichmentDelta : this.enrichmentDeltaAvg;

    this.baselineAvg = this.exponentialSmooth(this.baselineAvg, safeBaseline);
    this.structureAvg = this.exponentialSmooth(this.structureAvg, safeStructure);
    this.enrichmentDeltaAvg = this.exponentialSmooth(this.enrichmentDeltaAvg, safeDelta);

    const newValue =
      0.5 * this.baselineAvg +
      0.3 * this.structureAvg +
      0.2 * this.enrichmentDeltaAvg;

    this.current = this.clamp(
      0.8 * this.current + 0.2 * newValue,
      this.minBound,
      this.maxBound
    );
  }

  get(): number {
    return this.current;
  }

  private exponentialSmooth(prev: number, next: number): number {
    return prev * 0.9 + next * 0.1;
  }

  private clamp(value: number, min: number, max: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
  }
}

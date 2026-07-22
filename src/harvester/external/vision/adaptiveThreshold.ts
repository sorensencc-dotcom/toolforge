export class AdaptiveThreshold {
  baselineAvg: number;
  structureAvg: number;
  enrichmentDeltaAvg: number;
  private current: number;

  constructor(initial: number = 0.72) {
    this.baselineAvg = initial;
    this.structureAvg = initial;
    this.enrichmentDeltaAvg = 0.1;
    this.current = initial;
  }

  update(baseline: number, structure: number, enrichmentDelta: number): void {
    this.baselineAvg = this.exponentialSmooth(this.baselineAvg, baseline);
    this.structureAvg = this.exponentialSmooth(this.structureAvg, structure);
    this.enrichmentDeltaAvg = this.exponentialSmooth(this.enrichmentDeltaAvg, enrichmentDelta);

    const newValue =
      0.5 * this.baselineAvg +
      0.3 * this.structureAvg +
      0.2 * this.enrichmentDeltaAvg;

    this.current = this.clamp(
      0.8 * this.current + 0.2 * newValue,
      0.6,
      0.85
    );
  }

  get(): number {
    return this.current;
  }

  private exponentialSmooth(prev: number, next: number): number {
    return prev * 0.9 + next * 0.1;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

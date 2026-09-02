import { deriveSignalStrength } from '../src/signalStrength';

describe('deriveSignalStrength', () => {
  it('returns low when there are no corroborating hits at all', () => {
    expect(deriveSignalStrength([{ consistent: false }, { consistent: false }])).toBe('low');
  });

  it('returns low for a single ambiguous/contradictory hit among several', () => {
    expect(deriveSignalStrength([{ consistent: true }, { consistent: false }, { consistent: false }])).toBe('low');
  });

  it('returns medium for a majority-consistent but small hit set', () => {
    expect(deriveSignalStrength([{ consistent: true }, { consistent: true }, { consistent: false }])).toBe('medium');
  });

  it('returns high for several consistent hits with high agreement', () => {
    expect(deriveSignalStrength([
      { consistent: true }, { consistent: true }, { consistent: true }, { consistent: true },
    ])).toBe('high');
  });
});

export type SignalStrength = 'low' | 'medium' | 'high';

export interface SearchHit {
  consistent: boolean;
}

export function deriveSignalStrength(hits: SearchHit[]): SignalStrength {
  if (hits.length === 0) return 'low';

  const corroborating = hits.filter((h) => h.consistent).length;
  if (corroborating === 0) return 'low';

  const consistencyRatio = corroborating / hits.length;
  if (corroborating >= 3 && consistencyRatio >= 0.8) return 'high';
  if (corroborating >= 1 && consistencyRatio >= 0.5) return 'medium';
  return 'low';
}

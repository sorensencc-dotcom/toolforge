export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3';

export interface ScoreBreakdown {
  completeness: number; // 0 - 35
  urgency: number; // 0 - 30
  domainScope: number; // 0 - 20
  actionability: number; // 0 - 15
}

export interface TicketScoreResult {
  totalScore: number; // 0 - 100
  tier: PriorityTier;
  breakdown: ScoreBreakdown;
  flags: string[];
}

export interface ScorerConfig {
  knownDomains: string[];
  urgencyKeywords: Record<string, number>;
  minBodyWordCount: number;
  overrideP0Keywords: string[];
  scoreThresholds: {
    p0: number;
    p1: number;
    p2: number;
  };
}

export type ScorerOptions = Partial<Omit<ScorerConfig, 'scoreThresholds'>> & {
  scoreThresholds?: Partial<ScorerConfig['scoreThresholds']>;
};

export const DEFAULT_CONFIG: ScorerConfig = {
  knownDomains: [
    'core',
    'engine',
    'governance',
    'sync',
    'ledger',
    'ast',
    'cli',
    'auth',
  ],
  urgencyKeywords: {
    corrupt: 15,
    panic: 15,
    critical: 12,
    blocker: 12,
    blocking: 10,
    regression: 10,
    leak: 10,
    urgent: 8,
    asap: 6,
    fixme: 4,
  },
  minBodyWordCount: 20,
  overrideP0Keywords: ['panic', 'regression', 'corrupt'],
  scoreThresholds: {
    p0: 80,
    p1: 60,
    p2: 35,
  },
};

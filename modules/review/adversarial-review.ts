export interface Finding {
  readonly id: string;
  readonly file: string;
  readonly summary: string;
  readonly trigger: string;
  readonly likelihood: number;
  readonly cost: number;
  readonly risk: number;
  readonly fixRecipe: string;
}

export interface NoiseItem {
  readonly summary: string;
  readonly whyHypothetical: string;
}

export interface ReviewResult {
  readonly findings: readonly Finding[];
  readonly noise: readonly NoiseItem[];
}

export interface DefensiveRule {
  readonly name: string;
  readonly pattern: RegExp;
}

export const DEFENSIVE_RULES = [
  {
    name: 'null-check',
    pattern:
      /\b(?:null|nil|undefined)[\s-]+(?:check|guard)(?:s|ing)?\b|\b(?:check|guard)(?:s|ing)?\s+(?:for|against)\s+(?:null|nil|undefined)\b/i,
  },
  { name: 'type-check', pattern: /\b(?:type|typeof|instanceof)[\s-]?check(?:s|ing)?\b/i },
  {
    name: 'input-validation',
    pattern:
      /\b(?:add|adding|extra|additional|redundant|more)\s+(?:\w+\s+)?validation\b|\bvalidat\w*\s+(?:\w+\s+)?(?:inputs?|arguments?|args|parameters?|params|types?)\b/i,
  },
  {
    name: 'guard-layer',
    pattern:
      /\b(?:guard|wrapper)[\s-]+(?:layer|clause)s?\b|\b(?:add|adding|introduce|introducing|new|extra|another)\s+(?:an?\s+)?(?:\w+\s+)?(?:guard|wrapper)s?\b/i,
  },
  {
    name: 'defensive-boilerplate',
    pattern: /\bdefensive|\bjust\s+in\s+case\b|\bto\s+be\s+safe\b|\bwrap\w*\s.{0,40}?\btry\W{0,3}catch\b/i,
  },
] as const satisfies readonly DefensiveRule[];

export type DefensiveRuleName = (typeof DEFENSIVE_RULES)[number]['name'];

export type SuppressedFinding = Finding & { readonly rule: DefensiveRuleName };

export type ReviewFlag = 'capped' | 'malformed';

export interface ReviewOutcome extends ReviewResult {
  readonly suppressed: readonly SuppressedFinding[];
  readonly flags: readonly ReviewFlag[];
  readonly pass: boolean;
}

const MAX_FINDINGS = 7;
const DEFAULT_THRESHOLD = 3;
const SUPPRESS_BELOW_LIKELIHOOD = 0.1;

export function parseReview(
  rawText: string,
  { threshold = DEFAULT_THRESHOLD }: { readonly threshold?: number } = {},
): ReviewOutcome {
  const document = parseJson(rawText);
  if (!isRecord(document) || !Array.isArray(document.findings)) {
    return { findings: [], noise: [], suppressed: [], flags: ['malformed'], pass: false };
  }

  // Noise never blocks, so a model noise entry with the wrong shape is dropped instead of failing the review.
  const noise: NoiseItem[] = (Array.isArray(document.noise) ? document.noise : [])
    .filter(isNoiseItem)
    .map(({ summary, whyHypothetical }) => ({ summary, whyHypothetical }));
  const findings: Finding[] = [];
  const suppressed: SuppressedFinding[] = [];
  for (const raw of document.findings) {
    const item = parseFinding(raw);
    if (item === null) return { findings: [], noise: [], suppressed: [], flags: ['malformed'], pass: false };
    if (!('risk' in item)) {
      noise.push(item);
      continue;
    }
    const rule = suppressionRule(item);
    if (rule === undefined) findings.push(item);
    else suppressed.push({ ...item, rule });
  }

  findings.sort(byRiskThenId);
  suppressed.sort(byRiskThenId);
  const kept = findings.slice(0, MAX_FINDINGS);
  return {
    findings: kept,
    noise,
    suppressed,
    flags: findings.length > MAX_FINDINGS ? ['capped'] : [],
    // "Every finding below" rather than "none at or above", so a NaN threshold blocks; the finite check covers an empty list.
    pass: Number.isFinite(threshold) && kept.every((finding) => finding.risk < threshold),
  };
}

function parseJson(rawText: string): unknown {
  const text = rawText.trim();
  // Slicing the outer fence, not matching a lazy fence regex, keeps fences inside fixRecipe strings intact.
  const body = text.startsWith('```') && text.endsWith('```') ? text.slice(3, -3).replace(/^json\b/i, '') : text;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

// null means the finding is not shaped like a finding at all; a missing trigger is a modelling gap, so it demotes to noise.
function parseFinding(raw: unknown): Finding | NoiseItem | null {
  if (!isRecord(raw)) return null;
  const { id, file, summary, trigger, likelihood, cost, fixRecipe } = raw;
  if (
    typeof id !== 'string' ||
    typeof file !== 'string' ||
    typeof summary !== 'string' ||
    typeof fixRecipe !== 'string'
  ) {
    return null;
  }
  if (typeof likelihood !== 'number' || !(likelihood >= 0 && likelihood <= 1)) return null;
  if (typeof cost !== 'number' || !(cost >= 1 && cost <= 10)) return null;
  if (trigger !== undefined && typeof trigger !== 'string') return null;
  if (trigger === undefined || trigger.trim() === '') {
    return { summary, whyHypothetical: 'No concrete trigger condition.' };
  }
  // Rounding to 9 places makes 0.3 x 9 equal 2.7, not 2.6999999999999997, so a product on the threshold still blocks.
  const risk = Math.round(likelihood * cost * 1e9) / 1e9;
  return { id, file, summary, trigger, likelihood, cost, risk, fixRecipe };
}

// One rule match in the summary or fix recipe counts as "mainly recommends defensive code". The loose match is
// safe because only a finding under the likelihood cutoff is suppressed, and with cost at most 10 its risk is under 1.
function suppressionRule({ likelihood, summary, fixRecipe }: Finding): DefensiveRuleName | undefined {
  return likelihood < SUPPRESS_BELOW_LIKELIHOOD
    ? DEFENSIVE_RULES.find(({ pattern }) => pattern.test(summary) || pattern.test(fixRecipe))?.name
    : undefined;
}

function byRiskThenId(a: Finding, b: Finding): number {
  if (a.risk !== b.risk) return b.risk - a.risk;
  // Code-unit order rather than localeCompare, so the ranking is the same under every host locale.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNoiseItem(value: unknown): value is NoiseItem {
  return isRecord(value) && typeof value.summary === 'string' && typeof value.whyHypothetical === 'string';
}

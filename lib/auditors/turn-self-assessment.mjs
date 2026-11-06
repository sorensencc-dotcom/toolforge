import auditConfig from '../../config/audit.json' with { type: 'json' };

export const DEFAULT_AUDIT_CONFIG = Object.freeze({ ...auditConfig });

const fail = (reason, details = {}) => ({
  ...details,
  ok: false,
  verdict: 'FAIL',
  reason,
});

function validateConfig(config) {
  if (!config || !Number.isInteger(config.max_repeat_threshold) || config.max_repeat_threshold < 1) {
    throw new TypeError('INVALID_AUDIT_CONFIG');
  }
  if (!Number.isFinite(config.min_entropy_bits_per_character) || config.min_entropy_bits_per_character < 0) {
    throw new TypeError('INVALID_AUDIT_CONFIG');
  }
  if (!Number.isInteger(config.max_response_characters) || config.max_response_characters < 1) {
    throw new TypeError('INVALID_AUDIT_CONFIG');
  }
}

export function normalizeResponse(response, maxCharacters) {
  if (typeof response !== 'string') throw new TypeError('INVALID_RESPONSE');
  const normalized = response.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > maxCharacters) throw new TypeError('INVALID_RESPONSE');
  return normalized;
}

export function shannonEntropy(value) {
  if (!value) return 0;
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((entropy, count) => {
    const probability = count / value.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
}

export function responseDifference(previous, current) {
  if (previous === undefined) return 1;
  if (previous === current) return 0;
  const previousTokens = new Set(previous.split(' '));
  const currentTokens = new Set(current.split(' '));
  const union = new Set([...previousTokens, ...currentTokens]);
  const intersection = [...previousTokens].filter((token) => currentTokens.has(token)).length;
  return union.size === 0 ? 0 : 1 - intersection / union.size;
}

export function assessTurn({ turn, response, history = [], config = DEFAULT_AUDIT_CONFIG }) {
  validateConfig(config);
  if (!Number.isInteger(turn) || turn < 1) throw new TypeError('INVALID_TURN');
  const normalizedResponse = normalizeResponse(response, config.max_response_characters);
  if (!Array.isArray(history) || history.some((item) => typeof item !== 'string')) {
    throw new TypeError('INVALID_HISTORY');
  }

  const repeatCount = history.filter((item) => item === normalizedResponse).length + 1;
  const entropy = shannonEntropy(normalizedResponse);
  const difference = responseDifference(history.at(-1), normalizedResponse);
  const details = {
    ok: true,
    verdict: 'PASS',
    turn,
    normalizedResponse,
    repeatCount,
    entropyBitsPerCharacter: entropy,
    differenceRatio: difference,
  };

  if (repeatCount > config.max_repeat_threshold) {
    return fail('REPEATED_RESPONSE_THRESHOLD', details);
  }
  if (entropy < config.min_entropy_bits_per_character) {
    return fail('LOW_RESPONSE_ENTROPY', details);
  }
  return details;
}

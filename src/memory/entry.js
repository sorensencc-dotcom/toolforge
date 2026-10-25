export const MEMORY_KINDS = Object.freeze({
  fact: Object.freeze({ rankBoost: 0 }),
  decision: Object.freeze({ rankBoost: 1 }),
  constraint: Object.freeze({ rankBoost: 1 }),
  failure: Object.freeze({ rankBoost: 0 }),
});

export const MEMORY_KIND_NAMES = Object.freeze(Object.keys(MEMORY_KINDS));

export function parseMemoryKind(value) {
  if (!Object.hasOwn(MEMORY_KINDS, value)) {
    throw new TypeError(`Unknown memory kind ${JSON.stringify(value)}. Use one of ${MEMORY_KIND_NAMES.join(', ')}.`);
  }
  return value;
}

export function parseTag(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('Memory tags must be non-empty strings.');
  }
  return value.trim().toLowerCase();
}

function parseRequiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Memory ${field} must be a non-empty string.`);
  }
  return value.trim();
}

export function parseNewEntry({ kind, text, tags = [], source }) {
  if (!Array.isArray(tags)) {
    throw new TypeError('Memory tags must be an array of strings.');
  }
  return {
    kind: parseMemoryKind(kind),
    text: parseRequiredText(text, 'text'),
    tags: [...new Set(tags.map(parseTag))],
    source: parseRequiredText(source, 'source'),
  };
}

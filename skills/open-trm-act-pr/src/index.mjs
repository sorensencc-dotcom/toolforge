export function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function branchName(slug, issue) {
  const s = slugify(slug);
  if (!s) throw new Error('slug is required');
  const prefix = issue && !s.startsWith(`${issue}-`) ? `${issue}-` : '';
  return `trm/act-${prefix}${s}`;
}

export function commitSubject({ type = 'chore', scope, summary, issue }) {
  if (!summary) throw new Error('summary is required');
  const head = scope ? `${type}(${scope})` : type;
  return `${head}: ${summary}${issue ? ` (closes #${issue})` : ''}`;
}

export function prBody({ why, scope = [], tradeoffs, blastRadius, tests }) {
  const need = { why, tradeoffs, blastRadius, tests };
  for (const [k, v] of Object.entries(need)) if (!v) throw new Error(`${k} is required`);
  return [
    '## Why', '', why, '',
    '## Scope', '', ...scope.map((s) => `- ${s}`), '',
    '## Tradeoffs', '', tradeoffs, '',
    '## Blast Radius', '', blastRadius, '',
    '## Tests', '', tests, '',
  ].join('\n');
}

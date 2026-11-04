const TARGET_REPOS = {
  toolforge: 'sorensencc-dotcom/toolforge',
  sigil: 'sorensencc-dotcom/sigil',
  'kb-sync': 'sorensencc-dotcom/kb-sync',
  kbsync: 'sorensencc-dotcom/kb-sync',
  rewrite: 'sorensencc-dotcom/rewrite-mcp',
  'rewrite-mcp': 'sorensencc-dotcom/rewrite-mcp',
  icf: 'sorensencc-dotcom/icf',
  personalos: 'sorensencc-dotcom/personal-os',
  'personal-os': 'sorensencc-dotcom/personal-os',
  ironledger: 'sorensencc-dotcom/IronLedger'
};

const GENERIC_CRITERIA = new Set([
  'technical directives implemented according to specifications',
  'implements requirements according to specifications',
  'verification test suite authored and passing',
  'tests pass with zero regressions',
  'pr opened referencing this issue number'
]);

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asList(value) {
  if (Array.isArray(value)) return value.flatMap(asList);
  if (value && typeof value === 'object') return Object.values(value).flatMap(asList);
  return value == null ? [] : [String(value)];
}

function repoFromTarget(value) {
  const key = normalize(value).toLowerCase().replace(/^target[-_]/, '').replace(/[_ ]/g, '-');
  return TARGET_REPOS[key] || (key.includes('/') ? key : null);
}

function repoFromIssueUrl(value) {
  const match = String(value || '').match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return match ? match[1] : null;
}

function bodyFor(card) {
  if (card?.context?.body_fetch_failed === true) return '';
  return normalize(card?.body ?? card?.raw_content ?? card?.context?.body ?? card?.summary);
}

function criteriaFor(card, body) {
  const explicit = [
    card?.acceptance_criteria,
    card?.acceptanceCriteria,
    card?.acceptance,
    card?.criteria,
    card?.deliverables
  ].flatMap(asList);
  const section = body.match(/(?:^|\n)\s*(?:#+\s*)?acceptance criteria\s*:?\s*\n([\s\S]*)/i)?.[1] || '';
  return [...explicit, ...section.split(/\r?\n/)]
    .map(value => normalize(value).replace(/^[-*\[\]\d.)]+\s*/, ''))
    .filter(value => value && !GENERIC_CRITERIA.has(value.toLowerCase()));
}

export function validateCardIntegrity(card = {}, options = {}) {
  const body = bodyFor(card);
  if (!body || /\.gdoc(?:\s|$)/i.test(body) || /\d{4}-\d{2}-\d{2}T\d{6}Z__[^\s]+__[^\s]+__[^\s]+/i.test(body)) {
    return { valid: false, reason: 'BODY_EXTRACTION_FAILED', error: 'Document body extraction failed' };
  }

  if (criteriaFor(card, body).length === 0) {
    return { valid: false, reason: 'NO_ACCEPTANCE_CRITERIA', error: 'No real acceptance criteria present' };
  }

  const declaredRepos = [
    card.repo,
    card.target_repo,
    card.issue_url && repoFromIssueUrl(card.issue_url),
    repoFromTarget(card.target),
    repoFromTarget(card.domain),
    repoFromTarget(card.target_notebook_name),
    repoFromTarget(card.target_notebook)
  ].filter(Boolean);
  const canonicalRepos = declaredRepos.map(repo => repo.toLowerCase());
  if (new Set(canonicalRepos).size > 1) {
    return { valid: false, reason: 'REPO_MISMATCH', error: 'Card repository fields do not agree' };
  }

  const id = normalize(card.id || card.action_id).toLowerCase();
  const existingIds = [
    ...(options.existingIds || []),
    ...(options.existingCards || []).map(existing => existing?.id || existing?.action_id)
  ].map(value => normalize(value).toLowerCase()).filter(Boolean);
  if (id && existingIds.includes(id)) {
    return { valid: false, reason: 'DUPLICATE_ID', error: 'Card id already exists' };
  }

  return { valid: true };
}

export function cardBody(card = {}) {
  return bodyFor(card);
}

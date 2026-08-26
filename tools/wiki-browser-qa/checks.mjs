const result = (name, passed, details) => ({
  name,
  passed: Boolean(passed),
  details: String(details || (passed ? 'ok' : 'failed')),
});

const textOf = (value) => (typeof value === 'string' ? value.trim() : '');

export function checkHeadings(headings = []) {
  const h1s = headings.filter((heading) => Number(heading?.level) === 1 && textOf(heading?.text));
  return result('headings', h1s.length === 1, h1s.length === 1
    ? 'one meaningful level-one heading'
    : `expected one meaningful level-one heading, found ${h1s.length}`);
}

function slugLike(value, url = '') {
  const text = textOf(value);
  if (!text || /^https?:\/\//i.test(text) || /[/?#]/.test(text)) return true;
  const urlSlug = textOf(url).split('/').filter(Boolean).pop()?.replace(/\.html?$/i, '');
  if (urlSlug && text.toLowerCase() === decodeURIComponent(urlSlug).toLowerCase() && /[-_]/.test(text)) return true;
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(text);
}

export function checkReadableTitle(title, headings = [], url = '') {
  const visibleHeading = headings.find((heading) => Number(heading?.level) === 1)?.text;
  const passed = textOf(title) !== '' && textOf(visibleHeading) !== ''
    && !slugLike(title, url) && !slugLike(visibleHeading, url);
  return result('readable-title', passed, passed
    ? 'title and level-one heading are readable'
    : 'title and visible level-one heading must be human-readable, not a URL slug');
}

export function checkHiddenFrontmatter(bodyText = '') {
  const body = String(bodyText || '');
  const hasDelimiter = /^\s*---\s*$/m.test(body);
  const hasMetadataKey = /^\s*(?:title|slug|description|sidebar_label|sidebarLabel|layout|tags|author|date)\s*:/im.test(body);
  const passed = !hasDelimiter && !hasMetadataKey;
  return result('hidden-frontmatter', passed, passed ? 'no rendered YAML frontmatter' : 'YAML delimiter or frontmatter key is visible');
}

export function checkLinks(links = []) {
  const invalid = links.filter((link) => {
    if (link?.inScope === false) return false;
    const status = Number(link?.status);
    const successfulStatus = Number.isInteger(status) && status >= 200 && status < 300;
    return link?.ok !== true && !successfulStatus;
  });
  return result('links', invalid.length === 0, invalid.length === 0
    ? 'all in-scope links resolve'
    : `${invalid.length} in-scope link(s) failed to resolve`);
}

export function checkConsoleAndNetwork(observation = {}) {
  const consoleErrors = [...(observation.consoleErrors || []), ...(observation.consoleFailures || [])];
  const failedRequests = [...(observation.failedRequests || []), ...(observation.networkFailures || [])];
  const passed = consoleErrors.length === 0 && failedRequests.length === 0;
  return result('console-and-network', passed, passed
    ? 'no console errors or failed network requests'
    : `${consoleErrors.length} console error(s), ${failedRequests.length} failed request(s)`);
}

export function checkImages(images = []) {
  const broken = images.filter((image) => {
    const width = Number(image?.naturalWidth);
    const height = Number(image?.naturalHeight);
    return !textOf(image?.alt)
    || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
    || image?.loaded === false || image?.complete === false;
  });
  return result('images', broken.length === 0, broken.length === 0
    ? 'all rendered images have alt text and natural dimensions'
    : `${broken.length} rendered image(s) are missing alt text or failed to load`);
}

export function checkResponsiveOverflow(viewports = []) {
  const overflowing = viewports.filter((viewport) => viewport?.overflow === true
    || (Number.isFinite(Number(viewport?.scrollWidth))
      && Number.isFinite(Number(viewport?.clientWidth))
      && Number(viewport.scrollWidth) > Number(viewport.clientWidth)));
  return result('responsive-overflow', overflowing.length === 0, overflowing.length === 0
    ? 'supported viewports have no unexpected horizontal overflow'
    : `${overflowing.length} supported viewport(s) overflow horizontally`);
}

function matchesPolicy(evidence, rule) {
  const sourceAsset = rule.sourceAsset || rule.sourceMapping;
  if (!sourceAsset || evidence.sourceAsset !== sourceAsset) return false;
  if (rule.selector && evidence.selector !== rule.selector) return false;
  if (rule.assetPattern && !new RegExp(rule.assetPattern).test(String(evidence.src || ''))) return false;
  return true;
}

function meetsViewportRequirements(evidence, requirements = {}) {
  return Object.entries(requirements).every(([name, expected]) => {
    const observed = evidence.viewports?.[name];
    if (!observed) return false;
    if (expected.requireVisible === true && observed.visible !== true) return false;
    if (expected.allowHorizontalOverflow === false && observed.overflow === true) return false;
    return true;
  });
}

export function checkDiagramEvidence(diagrams = [], policyRule = {}) {
  const requirements = policyRule.requiredDiagrams || policyRule.diagrams || [];
  if (requirements.length === 0) return result('diagram-evidence', true, 'no diagrams required by policy');
  const failures = requirements.filter((rule) => {
    const evidence = diagrams.find((candidate) => matchesPolicy(candidate, rule));
    return !evidence || evidence.fencedAscii === true || evidence.visible !== true || evidence.loaded !== true
      || evidence.sourceBacked !== true || (rule.requireAlt !== false && !textOf(evidence.alt))
      || (rule.requireCaption !== false && !textOf(evidence.caption) && !textOf(evidence.explanatoryHeading))
      || !meetsViewportRequirements(evidence, rule.viewports);
  });
  return result('diagram-evidence', failures.length === 0, failures.length === 0
    ? 'required diagrams are visible, loaded, accessible, and source-backed'
    : `${failures.length} required diagram(s) lack valid rendered evidence`);
}

export function checkPageObservation(observation = {}, policyRule = {}) {
  return [
    checkHeadings(observation.headings),
    checkReadableTitle(observation.title, observation.headings, observation.url),
    checkHiddenFrontmatter(observation.bodyText),
    checkLinks(observation.links),
    checkConsoleAndNetwork(observation),
    checkImages(observation.images),
    checkResponsiveOverflow(observation.viewports),
    checkDiagramEvidence(observation.diagrams, policyRule),
  ];
}

import { mkdir, writeFile } from 'node:fs/promises';

import policy from './diagram-policy.json' with { type: 'json' };
import { createBrowserAdapter } from './browser-adapter.mjs';
import { checkPageObservation } from './checks.mjs';

const DEFAULT_BASE_URL = 'https://github.com/sorensencc-dotcom/toolforge/wiki';
const DEFAULT_REPORT_PATH = '.artifacts/wiki-qa/report.json';
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 4;
const MAX_ATTEMPTS = 2;
const TRANSIENT_ERROR_KINDS = new Set(['timeout', 'network', 'network-failure', 'navigation', 'navigation-failure']);

function asPositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('WIKI_QA_BASE_URL must not include credentials');
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href.replace(/\/$/, '');
}

function canonicalUrl(value, baseUrl) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  const resolved = /^https?:\/\//i.test(candidate)
    ? new URL(candidate)
    : new URL(candidate.replace(/^\/+/, ''), `${baseUrl}/`);
  if (resolved.username || resolved.password) return null;
  resolved.search = '';
  resolved.hash = '';
  resolved.pathname = resolved.pathname.replace(/\/+$/, '');
  return resolved.href.replace(/\/$/, '');
}

function slugFor(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || 'Home');
}

function policyFor(slug, document) {
  return document.pages?.find((page) => page.slug === slug) ?? {};
}

function normalizeObservation(observation = {}) {
  const headings = Array.isArray(observation.headings)
    ? observation.headings
    : (observation.domAssertions ?? []).filter((item) => item?.role === 'heading');
  const viewport = observation.viewports ?? observation.viewport ?? {};
  return {
    ...observation,
    headings,
    bodyText: observation.bodyText ?? observation.text ?? '',
    viewports: Array.isArray(viewport)
      ? viewport
      : Object.entries(viewport).map(([name, value]) => ({ name, ...value })),
  };
}

function errorSummary(error) {
  return {
    kind: error?.kind ?? 'navigation-failure',
    message: String(error?.message ?? 'page navigation failed').replace(/https?:\/\/[^\s@]+@/gi, 'https://'),
  };
}

function isTransient(error) {
  return error?.transient === true || TRANSIENT_ERROR_KINDS.has(error?.kind);
}

function nowMilliseconds(clock) {
  const value = clock.now();
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : Date.now();
}

function timestamp(clock) {
  const value = clock.now();
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function pageResult(url, status, details = {}) {
  return {
    url,
    slug: slugFor(url),
    status,
    checks: details.checks ?? [],
    consoleErrors: details.consoleErrors ?? [],
    failedRequests: details.failedRequests ?? [],
    diagramEvidence: details.diagramEvidence ?? [],
    sourceMapping: details.sourceMapping ?? [],
    viewports: details.viewports ?? [],
    attempts: details.attempts ?? 0,
    ...(details.error ? { error: details.error } : {}),
  };
}

function aggregatePages(pages) {
  const checks = pages.flatMap((page) => page.checks);
  return {
    total: pages.length,
    passed: pages.filter((page) => page.status === 'passed').length,
    failed: pages.filter((page) => page.status === 'failed').length,
    unfinished: pages.filter((page) => page.status === 'unfinished').length,
    checks: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
  };
}

async function writeReport(fs, reportPath, report) {
  if (typeof fs.mkdir === 'function') await fs.mkdir(reportPath.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function explicitUrls(env, baseUrl) {
  if (!env.WIKI_QA_PAGES?.trim()) return null;
  return env.WIKI_QA_PAGES.split(',')
    .map((page) => canonicalUrl(page, baseUrl))
    .filter(Boolean);
}

function discoveredUrls(observation, baseUrl) {
  const base = new URL(baseUrl);
  const prefix = `${base.pathname}/`;
  return (observation.links ?? [])
    .filter((link) => link?.inScope !== false)
    .map((link) => canonicalUrl(link?.href, baseUrl))
    .filter((url) => {
      if (!url || url === baseUrl) return false;
      const candidate = new URL(url);
      return candidate.origin === base.origin && candidate.pathname.startsWith(prefix);
    });
}

function dedupe(urls) {
  return [...new Map(urls.map((url) => [url.toLowerCase(), url])).values()];
}

async function auditPage(url, context) {
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const raw = await context.adapter.openPage(url, { timeoutMs: context.pageTimeoutMs });
      const observation = normalizeObservation(raw);
      const policyRule = policyFor(slugFor(url), context.policy);
      const checks = checkPageObservation({ ...observation, url }, policyRule);
      return pageResult(url, checks.every((check) => check.passed) ? 'passed' : 'failed', {
        checks,
        consoleErrors: observation.consoleErrors ?? [],
        failedRequests: observation.failedRequests ?? [],
        diagramEvidence: observation.diagrams ?? [],
        sourceMapping: policyRule.sourceMappings ?? [],
        viewports: observation.viewports ?? [],
        attempts,
      });
    } catch (error) {
      if (!isTransient(error) || attempts === MAX_ATTEMPTS) {
        return pageResult(url, 'failed', { attempts, error: errorSummary(error) });
      }
      await context.clock.sleep(0);
    }
  }
  return pageResult(url, 'failed', { attempts });
}

export async function runWikiQa(env = process.env, dependencies = {}) {
  const fs = dependencies.fs ?? { mkdir, writeFile };
  const clock = dependencies.clock ?? { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
  const adapter = dependencies.adapter ?? createBrowserAdapter({ timeoutMs: asPositiveInteger(env.WIKI_QA_TIMEOUT_MS, 30_000) });
  const activePolicy = dependencies.policy ?? policy;
  const signal = dependencies.signal;
  const baseUrl = normalizeBaseUrl(env.WIKI_QA_BASE_URL);
  const reportPath = env.WIKI_QA_REPORT || DEFAULT_REPORT_PATH;
  const concurrency = asPositiveInteger(env.WIKI_QA_CONCURRENCY, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
  const pageTimeoutMs = asPositiveInteger(env.WIKI_QA_TIMEOUT_MS, 30_000);
  const startedAt = nowMilliseconds(clock);
  const report = {
    target: baseUrl,
    timestamp: timestamp(clock),
    pages: [],
    aggregate: { total: 0, passed: 0, failed: 0, unfinished: 0, checks: { total: 0, passed: 0, failed: 0 } },
    partial: false,
    ...(reportPath ? { reportPath } : {}),
  };
  let urls;

  try {
    const executable = await adapter.checkExecutable();
    report.browser = { available: executable.available === true, version: executable.version ?? null, diagnostics: executable.diagnostics ?? '' };
    if (executable.available !== true) {
      report.partial = true;
      report.reason = 'browser setup unavailable';
      report.aggregate = aggregatePages(report.pages);
      await writeReport(fs, reportPath, report);
      return { report, exitCode: 1 };
    }

    urls = explicitUrls(env, baseUrl);
    if (!urls) {
      const index = await adapter.openPage(baseUrl, { timeoutMs: pageTimeoutMs });
      urls = discoveredUrls(index, baseUrl);
    }
    urls = dedupe(urls);
    if (urls.length === 0) {
      report.partial = true;
      report.reason = 'no pages discovered';
    }
    const pages = new Array(urls.length);
    let next = 0;
    let stoppedReason = null;
    const shouldStop = () => {
      if (signal?.aborted) return 'interrupted';
      return nowMilliseconds(clock) - startedAt >= pageTimeoutMs ? 'timeout' : null;
    };
    const worker = async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= urls.length) return;
        stoppedReason ??= shouldStop();
        if (stoppedReason) {
          pages[index] = pageResult(urls[index], 'unfinished');
          continue;
        }
        const result = await auditPage(urls[index], { adapter, clock, policy: activePolicy, pageTimeoutMs });
        stoppedReason ??= shouldStop();
        pages[index] = stoppedReason && result.status === 'passed'
          ? pageResult(urls[index], 'unfinished', { attempts: result.attempts })
          : result;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
    report.pages = pages.map((page, index) => page ?? pageResult(urls[index], 'unfinished'));
    if (stoppedReason) {
      report.partial = true;
      report.reason = stoppedReason;
    }
  } catch (error) {
    report.partial = true;
    report.reason = errorSummary(error).message;
    report.discoveryError = errorSummary(error);
  } finally {
    try { await adapter.close(); } catch { /* best-effort browser shutdown */ }
  }

  report.aggregate = aggregatePages(report.pages);
  await writeReport(fs, reportPath, report);
  return { report, exitCode: report.aggregate.failed > 0 || report.aggregate.unfinished > 0 || report.partial ? 1 : 0 };
}

async function main() {
  const { report, exitCode } = await runWikiQa(process.env);
  console.log(`Wiki QA: ${report.aggregate.passed}/${report.aggregate.total} pages passed; report: ${report.reportPath}`);
  if (report.partial) console.error(`Wiki QA partial: ${report.reason ?? 'unfinished pages'}`);
  process.exitCode = exitCode;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => {
    console.error(`Wiki QA failed: ${error.message}`);
    process.exitCode = 1;
  });
}

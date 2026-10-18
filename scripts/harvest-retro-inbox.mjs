#!/usr/bin/env node
// Files the recommendations in dated retros as retro inbox entries, per .context/retros/INBOX-SPEC.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  INBOX_DIR,
  INBOX_REGISTRY,
  INBOX_SCHEMA,
  computeFindingId,
  validateEntry,
  validateInbox,
} from './validate-retro-inbox.mjs';

const CONFIG_FILE = fileURLToPath(new URL('../.context/retros/harvest/config.json', import.meta.url));
const LEDGER_FILE = '.context/retros/harvest/ledger.jsonl';
const RETRO_DIR = '.context/retros';
const DATED_RETRO = /^(\d{4}-\d{2}-\d{2})-(\d+)\.json$/;
const AGENT = 'ci';
const SUMMARY_MAX = INBOX_SCHEMA.properties.findings.items.properties.summary.maxLength;
const REPO_NAME = new RegExp(INBOX_SCHEMA.properties.repo.pattern, 'u');
const USAGE = 'usage: node scripts/harvest-retro-inbox.mjs [--dry-run] [--config <file>]';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizeCategory = (category) => category.trim().toLowerCase();
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const count = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

function unknownFields(value, allowed, at) {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${at}.${key} is not an allowed field`);
}

export function configErrors(config) {
  if (!isObject(config)) return ['config must be a JSON object'];
  const errors = unknownFields(config, ['repos', 'severity', 'categoryTags'], 'config');
  if (!Array.isArray(config.repos) || config.repos.length === 0) {
    errors.push('config.repos must be a non-empty array');
  } else {
    config.repos.forEach((item, index) => {
      const at = `config.repos[${index}]`;
      if (!isObject(item)) {
        errors.push(`${at} must be an object`);
        return;
      }
      errors.push(...unknownFields(item, ['repo', 'path'], at));
      if (typeof item.repo !== 'string' || !REPO_NAME.test(item.repo)) errors.push(`${at}.repo must be a repository name`);
      if (typeof item.path !== 'string' || !item.path.trim()) errors.push(`${at}.path must be a directory path`);
    });
  }
  const severities = Object.keys(INBOX_REGISTRY.severities);
  if (!severities.includes(config.severity)) errors.push(`config.severity must be one of ${severities.join(', ')}`);
  if (!isObject(config.categoryTags)) {
    errors.push('config.categoryTags must be an object');
  } else {
    const tags = Object.keys(INBOX_REGISTRY.tags);
    for (const [category, tag] of Object.entries(config.categoryTags)) {
      if (category !== normalizeCategory(category)) errors.push(`config.categoryTags.${category} must be a trimmed lowercase category`);
      if (!tags.includes(tag)) errors.push(`config.categoryTags.${category} must be one of ${tags.join(', ')}`);
    }
  }
  return errors;
}

function tagFor(category, categoryTags) {
  const key = normalizeCategory(category);
  if (Object.hasOwn(categoryTags, key)) return categoryTags[key];
  const tag = key.toUpperCase();
  return Object.hasOwn(INBOX_REGISTRY.tags, tag) ? tag : undefined;
}

function toSummary(text) {
  const line = text.trim().replace(/\s+/g, ' ');
  const chars = [...line];
  if (chars.length <= SUMMARY_MAX) return line;
  const head = chars.slice(0, SUMMARY_MAX - 1).join('');
  const cut = head.lastIndexOf(' ');
  return `${cut > 0 ? head.slice(0, cut) : head}…`;
}

export function recommendationFindings({ repo, source, retro, config }) {
  const recommendations = isObject(retro) ? retro.recommendations : undefined;
  if (recommendations === undefined) return { findings: [], warnings: [] };
  if (!Array.isArray(recommendations)) {
    return { findings: [], warnings: [`${repo} ${source}: recommendations is not an array, skipped`] };
  }
  const findings = [];
  const warnings = [];
  recommendations.forEach((item, index) => {
    const pointer = `${source}#/recommendations/${index}`;
    const { category, text } = isObject(item) ? item : {};
    if (typeof category !== 'string' || typeof text !== 'string' || !text.trim()) {
      warnings.push(`${repo} ${pointer}: needs a string category and non-blank text, skipped`);
      return;
    }
    const tag = tagFor(category, config.categoryTags);
    if (!tag) {
      warnings.push(`${repo} ${pointer}: category "${category}" names no tag, skipped until categoryTags maps it`);
      return;
    }
    const summary = toSummary(text);
    findings.push({
      source: pointer,
      finding: {
        id: computeFindingId({ repo, tag, summary }),
        tag,
        severity: config.severity,
        summary,
        evidence: [pointer],
        suggestion: text.trim(),
      },
    });
  });
  return { findings, warnings };
}

function freeEntryFile(files, date, slug) {
  for (let part = 1; ; part += 1) {
    const file = `${INBOX_DIR}/${AGENT}/${date}-${slug}${part === 1 ? '' : `-part-${part}`}.json`;
    if (!files.has(file)) return file;
  }
}

export function planHarvest({ retros, known, config, now }) {
  const ids = new Set(known.ids);
  const sources = new Set(known.sources);
  const files = new Set(known.files);
  const plan = { entries: [], warnings: [], errors: [], recorded: 0 };
  for (const { repo, source, date, seq, retro } of retros) {
    const { findings, warnings } = recommendationFindings({ repo, source, retro, config });
    plan.warnings.push(...warnings);
    const inRetro = new Set();
    const fresh = findings.filter(({ finding, source: pointer }) => {
      const isNew = !ids.has(finding.id) && !sources.has(`${repo}:${pointer}`) && !inRetro.has(finding.id);
      inRetro.add(finding.id);
      if (!isNew) plan.recorded += 1;
      return isNew;
    });
    if (fresh.length === 0) continue;
    const file = freeEntryFile(files, date, `${slugify(repo)}-retro-${seq}`);
    const entry = {
      schema: INBOX_REGISTRY.schema,
      agent: AGENT,
      repo,
      date,
      session: source,
      findings: fresh.map(({ finding }) => finding),
    };
    const { errors } = validateEntry(entry, file);
    if (errors.length > 0) {
      plan.errors.push(...errors.map((error) => `${repo} ${source}: ${error}`));
      continue;
    }
    files.add(file);
    const records = fresh.map(({ finding, source: pointer }) => {
      ids.add(finding.id);
      sources.add(`${repo}:${pointer}`);
      return { id: finding.id, repo, source: pointer, entry: file, harvestedAt: now };
    });
    plan.entries.push({ file, entry, records });
  }
  return plan;
}

function readJson(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return { value: JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) };
  } catch (error) {
    return { error: error.message.replace(/\s+/g, ' ') };
  }
}

function isDirectory(dir) {
  return fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function datedRetros(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((dirent) => {
      const match = dirent.isFile() ? DATED_RETRO.exec(dirent.name) : null;
      return match ? [{ name: dirent.name, date: match[1], seq: match[2] }] : [];
    })
    .sort((a, b) => (a.date === b.date ? Number(a.seq) - Number(b.seq) : a.date < b.date ? -1 : 1));
}

function readRetros(config) {
  const scan = { retros: [], lines: [], warnings: [] };
  for (const { repo, path: dir } of config.repos) {
    const label = `${repo} (${dir})`;
    if (!isDirectory(dir)) {
      scan.warnings.push(`${label}: repository directory not found, skipped`);
      continue;
    }
    const retroDir = path.join(dir, RETRO_DIR);
    if (!isDirectory(retroDir)) {
      scan.lines.push(`${label}: no ${RETRO_DIR} directory`);
      continue;
    }
    const files = datedRetros(retroDir);
    let withRecommendations = 0;
    for (const { name, date, seq } of files) {
      const source = `${RETRO_DIR}/${name}`;
      const parsed = readJson(path.join(retroDir, name));
      if ('error' in parsed) {
        scan.warnings.push(`${repo} ${source}: unreadable (${parsed.error}), skipped`);
        continue;
      }
      if (isObject(parsed.value) && Object.hasOwn(parsed.value, 'recommendations')) withRecommendations += 1;
      scan.retros.push({ repo, source, date, seq, retro: parsed.value });
    }
    scan.lines.push(`${label}: ${count(files.length, 'dated retro')}, ${withRecommendations} with recommendations`);
  }
  return scan;
}

function readKnown() {
  const inbox = validateInbox(INBOX_DIR);
  if (!inbox.ok) return { errors: inbox.errors.map((error) => `inbox invalid, nothing harvested: ${error}`) };
  const ledgerText = fs.existsSync(LEDGER_FILE) ? fs.readFileSync(LEDGER_FILE, 'utf8') : '';
  const known = {
    ids: inbox.entries.flatMap(({ entry }) => entry.findings.map(({ id }) => id)),
    sources: [],
    files: inbox.entries.map(({ path: file }) => file),
  };
  const warnings = [];
  ledgerText.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const { id, repo, source } = JSON.parse(line);
      known.ids.push(id);
      known.sources.push(`${repo}:${source}`);
    } catch {
      warnings.push(`${LEDGER_FILE}:${index + 1} is not a JSON record, ignored`);
    }
  });
  return { known, warnings, ledgerText };
}

function writePlan(entries, ledgerText) {
  if (entries.length === 0) return;
  fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  // A run that stopped mid-append leaves a partial last line, so the next record starts on its own line.
  let separator = ledgerText === '' || ledgerText.endsWith('\n') ? '' : '\n';
  for (const { file, entry, records } of entries) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // The entry lands before its ledger records, so a crash between them leaves ids the next run still reads.
    fs.writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, { flag: 'wx' });
    fs.appendFileSync(LEDGER_FILE, `${separator}${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
    separator = '';
  }
}

function harvest({ config, dryRun }) {
  const scan = readRetros(config);
  const state = readKnown();
  if (state.errors) return { lines: scan.lines, warnings: scan.warnings, errors: state.errors, entries: [], recorded: 0 };
  const plan = planHarvest({ retros: scan.retros, known: state.known, config, now: new Date().toISOString() });
  if (!dryRun) writePlan(plan.entries, state.ledgerText);
  return {
    lines: scan.lines,
    warnings: [...scan.warnings, ...state.warnings, ...plan.warnings],
    errors: plan.errors,
    entries: plan.entries,
    recorded: plan.recorded,
  };
}

function main(args) {
  let options;
  try {
    ({ values: options } = parseArgs({ args, options: { 'dry-run': { type: 'boolean' }, config: { type: 'string' } } }));
  } catch {
    console.error(USAGE);
    return 2;
  }
  const configFile = options.config ?? CONFIG_FILE;
  const loaded = readJson(configFile);
  const errors = 'error' in loaded ? [loaded.error] : configErrors(loaded.value);
  if (errors.length > 0) {
    console.error(`retro harvest config invalid: ${configFile}`);
    for (const error of errors) console.error(`  ${error}`);
    return 2;
  }
  const dryRun = options['dry-run'] === true;
  const report = harvest({ config: loaded.value, dryRun });
  for (const line of report.lines) console.log(line);
  for (const warning of report.warnings) console.error(`warning: ${warning}`);
  for (const error of report.errors) console.error(`error: ${error}`);
  const verb = dryRun ? 'would write' : 'wrote';
  for (const { file, entry } of report.entries) {
    console.log(`${verb} ${file}`);
    for (const { id, tag, summary } of entry.findings) console.log(`  ${id} ${tag} ${summary}`);
  }
  const findings = report.entries.reduce((total, { entry }) => total + entry.findings.length, 0);
  console.log(`retro harvest${dryRun ? ' (dry run)' : ''}: ${verb} ${count(findings, 'new finding')} in ${count(report.entries.length, 'entry', 'entries')}, ${report.recorded} already recorded, ${count(report.warnings.length, 'warning')}`);
  return report.errors.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

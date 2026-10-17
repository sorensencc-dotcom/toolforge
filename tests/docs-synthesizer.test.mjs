import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  auditMarkdownText,
  isBadTitleCase,
  normalizeWikiFrontmatter,
  HEURISTIC_RULES,
} from '../skills/repo-docs-diagram-sync/src/docs-synthesizer.mjs';
import {
  stageWikiPages,
  parseArgs,
  runBenchmark,
} from '../scripts/docs-synthesizer.mjs';

test('auditMarkdownText: detects conversational throat clearing and filler words', () => {
  const markdown = `
Certainly! In this section, we will delve into system internals.
This game-changing update essentially simplifies state.
  `;
  const violations = auditMarkdownText(markdown, 'test.md');
  const rules = violations.map((v) => v.rule);

  assert.ok(rules.includes(HEURISTIC_RULES.THROAT_CLEARING), 'Flags throat clearing');
  assert.ok(rules.includes(HEURISTIC_RULES.FILLER_ADVERBS), 'Flags filler words');
});

test('auditMarkdownText: flags first-person plural and passive voice constructs', () => {
  const markdown = `
We recommend that you run tests before commit.
The configuration file is loaded by the supervisor process.
  `;
  const violations = auditMarkdownText(markdown, 'test.md');
  const rules = violations.map((v) => v.rule);

  assert.ok(rules.includes(HEURISTIC_RULES.FIRST_PERSON_PLURAL), 'Flags first-person plural');
  assert.ok(rules.includes(HEURISTIC_RULES.ACTIVE_VOICE), 'Flags passive voice');
});

test('auditMarkdownText: detects Title Case headings and generic link anchor text', () => {
  const markdown = `
# Advanced System Architecture Configuration
For additional details, please read [here](docs/guide.md).
  `;
  const violations = auditMarkdownText(markdown, 'test.md');
  const rules = violations.map((v) => v.rule);

  assert.ok(rules.includes(HEURISTIC_RULES.HEADING_SENTENCE_CASE), 'Flags Title Case heading');
  assert.ok(rules.includes(HEURISTIC_RULES.DESCRIPTIVE_LINKS), 'Flags generic link');
});

test('auditMarkdownText: flags missing serial Oxford commas in lists', () => {
  const markdown = `
Supports JSON, YAML and TOML configurations.
  `;
  const violations = auditMarkdownText(markdown, 'test.md');
  const rules = violations.map((v) => v.rule);

  assert.ok(rules.includes(HEURISTIC_RULES.SERIAL_COMMA), 'Flags missing Oxford comma');
});

test('auditMarkdownText: honors suppression comments with audit trail', () => {
  const markdown = `
<!-- heuristics-disable ban-throat-clearing author="soren" reason="Preserving introductory quote" until="2027-01-01" -->
Certainly! Here is an intentional intro.
<!-- heuristics-enable ban-throat-clearing -->
  `;
  const violations = auditMarkdownText(markdown, 'test.md');
  assert.equal(violations.length, 0, 'Suppression directive should silence rule');
});

test('isBadTitleCase: distinguishes Title Case from Sentence case with acronyms', () => {
  assert.equal(isBadTitleCase('Advanced System Architecture Design'), true);
  assert.equal(isBadTitleCase('System architecture and setup'), false);
  assert.equal(isBadTitleCase('Connecting to AWS and GCP services'), false);
  assert.equal(isBadTitleCase('Overview'), false);
});

test('normalizeWikiFrontmatter: converts frontmatter titles into clean headers', () => {
  const input = `---
title: "Platform Overview"
author: "Engineering"
---

Body of the wiki document.`;

  const output = normalizeWikiFrontmatter(input);
  assert.ok(output.includes('# Platform Overview'));
  assert.ok(output.includes('<!--'));
  assert.ok(output.includes('Body of the wiki document.'));
});

test('stageWikiPages: stages markdown and diagram assets into target mirror', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-src-'));
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-dst-'));

  fs.writeFileSync(path.join(src, 'Index.md'), '# Index Page\nContent.', 'utf8');
  fs.writeFileSync(path.join(src, 'diagram.png'), 'fake-png-bytes', 'utf8');

  const res = stageWikiPages({ sourceDir: src, targetDir: dst, dryRun: false });
  assert.equal(res.status, 'STAGED');
  assert.equal(res.staged, 2);
  assert.ok(fs.existsSync(path.join(dst, 'Index.md')));
  assert.ok(fs.existsSync(path.join(dst, 'diagram.png')));

  fs.rmSync(src, { recursive: true, force: true });
  fs.rmSync(dst, { recursive: true, force: true });
});

test('parseArgs & runBenchmark: parses CLI options and measures audit duration', () => {
  const opts = parseArgs(['--audit', '--sync-wiki', '--dry-run', '--benchmark']);
  assert.equal(opts.audit, true);
  assert.equal(opts.syncWiki, true);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.benchmark, true);

  const duration = runBenchmark();
  assert.ok(typeof duration === 'number');
  assert.ok(duration < 3500, `Benchmark elapsed (${duration}ms) must be under 3500ms`);
});

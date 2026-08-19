import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { lintText } from '../src/linter';
import { SuppressionRegistry } from '../src/suppressions';

describe('Linter 11-Rule and Suppression Suite', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('passes cleanly on pass-all.md fixture with 0 errors and 0 warnings', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'pass-all.md'), 'utf8');
    const res = lintText(content);
    expect(res.clean).toBe(true);
    expect(res.errorCount).toBe(0);
    expect(res.warningCount).toBe(0);
    expect(res.violations.length).toBe(0);
  });

  it('Rule 1: ban-throat-clearing detects conversational openers', () => {
    const text1 = 'Certainly! To configure the server, run setup.';
    const text2 = 'Sure thing, install the binary first.';
    const text3 = 'In this section, we review the architecture.';
    const text4 = "Let's dive into the core implementation.";
    expect(lintText(text1).violations.some((v) => v.ruleId === 'ban-throat-clearing')).toBe(true);
    expect(lintText(text2).violations.some((v) => v.ruleId === 'ban-throat-clearing')).toBe(true);
    expect(lintText(text3).violations.some((v) => v.ruleId === 'ban-throat-clearing')).toBe(true);
    expect(lintText(text4).violations.some((v) => v.ruleId === 'ban-throat-clearing')).toBe(true);
  });

  it('Rule 2: ban-filler-adverbs detects AI slop vocabulary', () => {
    const text = 'This essentially game-changing tool seamlessly streamlines performance to delve deeper.';
    const res = lintText(text);
    const rules = res.violations.filter((v) => v.ruleId === 'ban-filler-adverbs');
    expect(rules.length).toBeGreaterThanOrEqual(4);
  });

  it('Rule 3: avoid-first-person-plural detects royal we', () => {
    const text1 = 'We recommend setting the timeout to 30s.';
    const text2 = 'In our opinion, this approach is best.';
    expect(lintText(text1).violations.some((v) => v.ruleId === 'avoid-first-person-plural')).toBe(true);
    expect(lintText(text2).violations.some((v) => v.ruleId === 'avoid-first-person-plural')).toBe(true);
  });

  it('Rule 4: use-second-person detects third-person developer references', () => {
    const text1 = 'The user should click submit.';
    const text2 = 'The developer should configure the database.';
    const text3 = 'The engineer must verify the certificate.';
    expect(lintText(text1).violations.some((v) => v.ruleId === 'use-second-person')).toBe(true);
    expect(lintText(text2).violations.some((v) => v.ruleId === 'use-second-person')).toBe(true);
    expect(lintText(text3).violations.some((v) => v.ruleId === 'use-second-person')).toBe(true);
  });

  it('Rule 5: active-voice detects passive agent constructs', () => {
    const text1 = 'The request was handled by the server.';
    const text2 = 'The job is triggered nightly by the scheduler.';
    expect(lintText(text1).violations.some((v) => v.ruleId === 'active-voice')).toBe(true);
    expect(lintText(text2).violations.some((v) => v.ruleId === 'active-voice')).toBe(true);
  });

  it('Rule 6: assertion-density detects ungrounded hyperbole', () => {
    const text1 = 'This release provides vastly superior execution.';
    const text2 = 'Enjoy incredible speed and blazing fast queries.';
    expect(lintText(text1).violations.some((v) => v.ruleId === 'assertion-density')).toBe(true);
    expect(lintText(text2).violations.some((v) => v.ruleId === 'assertion-density')).toBe(true);
  });

  it('Rule 7: condition-before-action detects reversed imperative ordering', () => {
    const text = 'Send SIGHUP to the process if you want to reload configuration.';
    expect(lintText(text).violations.some((v) => v.ruleId === 'condition-before-action')).toBe(true);
  });

  it('Rule 8: heading-sentence-case flags Title Case headings', () => {
    const heading = '## Advanced Deployment Configuration And Setup';
    expect(lintText(heading).violations.some((v) => v.ruleId === 'heading-sentence-case')).toBe(true);
  });

  it('Rule 9: descriptive-links flags generic anchor texts', () => {
    const text1 = 'Click [here](https://example.com) for setup.';
    const text2 = 'For more info, see this [link](https://example.com).';
    const text3 = 'Read [more](https://example.com).';
    expect(lintText(text1).violations.some((v) => v.ruleId === 'descriptive-links')).toBe(true);
    expect(lintText(text2).violations.some((v) => v.ruleId === 'descriptive-links')).toBe(true);
    expect(lintText(text3).violations.some((v) => v.ruleId === 'descriptive-links')).toBe(true);
  });

  it('Rule 10: serial-comma flags missing Oxford commas', () => {
    const text = 'Supports JSON, YAML and TOML formats.';
    expect(lintText(text).violations.some((v) => v.ruleId === 'serial-comma')).toBe(true);
  });

  it('detects all violations on fail-rules.md fixture', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'fail-rules.md'), 'utf8');
    const res = lintText(content);
    expect(res.clean).toBe(false);
    expect(res.errorCount).toBeGreaterThanOrEqual(3);
    expect(res.warningCount).toBeGreaterThanOrEqual(10);
  });

  it('respects inline rule suppression directive', () => {
    const doc = `
<!-- heuristics-disable ban-filler-adverbs author="soren" reason="RFC quote" until="2099-01-01" -->
This essentially streamlines the pipeline.
<!-- heuristics-enable ban-filler-adverbs -->
`;
    const res = lintText(doc);
    expect(res.violations.filter((v) => v.ruleId === 'ban-filler-adverbs').length).toBe(0);
  });

  it('respects "all" rule suppression directive', () => {
    const doc = `
<!-- heuristics-disable all author="soren" reason="Legacy document" until="2099-01-01" -->
Certainly! We recommend that you click [here](docs.md) essentially.
`;
    const res = lintText(doc);
    expect(res.violations.length).toBe(0);
  });

  it('emits error violation on expired suppression directive', () => {
    const doc = `
<!-- heuristics-disable ban-filler-adverbs author="soren" reason="Temporary" until="2020-01-01" -->
This essentially streamlines the pipeline.
`;
    const res = lintText(doc);
    expect(res.violations.some((v) => v.ruleId === 'suppression-expired')).toBe(true);
  });
});

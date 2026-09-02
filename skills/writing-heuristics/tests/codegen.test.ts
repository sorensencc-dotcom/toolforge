import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { compileCatalog } from '../src/compiler';
import { getCatalog } from '../src/linter';

describe('Zero-Drift Codegen Invariant Suite', () => {
  const root = path.join(__dirname, '..');
  const catalogPath = path.join(root, 'heuristics.json');
  const skillPath = path.join(root, 'SKILL.md');
  const rulesPath = path.join(root, 'docs', 'rules.md');

  it('SKILL.md matches compileCatalog output byte-for-byte', () => {
    const { skillMd } = compileCatalog(catalogPath);
    const existing = fs.readFileSync(skillPath, 'utf8');
    expect(existing.replace(/\r\n/g, '\n').trim()).toBe(skillMd.replace(/\r\n/g, '\n').trim());
  });

  it('docs/rules.md matches compileCatalog output byte-for-byte', () => {
    const { rulesMd } = compileCatalog(catalogPath);
    const existing = fs.readFileSync(rulesPath, 'utf8');
    expect(existing.replace(/\r\n/g, '\n').trim()).toBe(rulesMd.replace(/\r\n/g, '\n').trim());
  });

  it('compiles exactly 11 canonical rules into markdown output', () => {
    const catalog = getCatalog(catalogPath);
    expect(catalog.rules.length).toBe(11);
    const { skillMd, rulesMd } = compileCatalog(catalogPath);
    for (const rule of catalog.rules) {
      expect(skillMd).toContain(rule.id);
      expect(rulesMd).toContain(rule.id);
      expect(rulesMd).toContain(rule.name);
    }
  });

  it('generates valid YAML frontmatter in SKILL.md', () => {
    const { skillMd } = compileCatalog(catalogPath);
    expect(skillMd.startsWith('---\nname: writing-heuristics\n')).toBe(true);
    expect(skillMd).toContain('version: 1.0.0');
  });

  it('generates a complete catalog index table in docs/rules.md', () => {
    const { rulesMd } = compileCatalog(catalogPath);
    expect(rulesMd).toContain('| Rule ID | Name | Severity | Handling | Category |');
    expect(rulesMd).toContain('| `ban-throat-clearing` |');
    expect(rulesMd).toContain('| `heading-sentence-case` |');
    expect(rulesMd).toContain('| `descriptive-links` |');
  });

  it('includes suppression syntax documentation in SKILL.md', () => {
    const { skillMd } = compileCatalog(catalogPath);
    expect(skillMd).toContain('## Suppression Syntax');
    expect(skillMd).toContain('<!-- heuristics-disable rule-id');
  });
});

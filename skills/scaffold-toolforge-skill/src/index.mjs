import fs from 'node:fs';
import path from 'node:path';

export const README_MAX = 100;
export const SKILL_MD_MAX = 150;
const GUIDE_LINK = '[Skill Operator Guide](../../docs/meta/skill-operator-guide.md)';

// Kebab-case id, 3-48 chars, not already taken. Returns { ok, reason }.
export function validateSkillId(id, existing = []) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
    return { ok: false, reason: 'id must be kebab-case: lowercase letters, digits, single hyphens, starting with a letter' };
  }
  if (id.length < 3 || id.length > 48) return { ok: false, reason: 'id must be 3-48 characters' };
  if (existing.includes(id)) return { ok: false, reason: `skill "${id}" already exists` };
  return { ok: true, reason: null };
}

const titleCase = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export function renderSkillJson({ id, description, category = 'automation', keywords = [] }) {
  return `${JSON.stringify({
    id,
    name: titleCase(id),
    version: '0.1.0',
    description,
    category,
    runtime: 'node',
    entrypoint: 'src/index.mjs',
    keywords,
    tags: keywords,
    commands: { test: `node --test --test-timeout=15000 skills/${id}/tests/index.test.mjs` },
    inputs: {},
    outputs: { summary: 'string' },
    dependencies: { internal: [], external: [] },
    tooltip: description,
  }, null, 2)}\n`;
}

// Manifest entry in the key order used by existing candidate skills.
export function manifestEntry({ id, description, category = 'automation', keywords = [], date, owner = 'soren' }) {
  const ts = `${date}T00:00:00Z`;
  return {
    version: '0.1.0',
    description,
    timestamps: { created: ts, lastValidation: ts, lastRun: null },
    tags: keywords,
    status: 'candidate',
    name: id,
    runtime: 'node',
    id,
    path: `skills/${id}`,
    entrypoint: 'src/index.mjs',
    owner,
    category,
    health: { canonical: true, runtime: 'good', distributed: false, overall: 'good' },
    dependencies: { external: [], internal: [] },
  };
}

// Append an entry to manifest.json text without reformatting the rest of the file.
export function insertManifestEntry(text, entry) {
  const marker = '\n  ],\n  "summary"';
  const at = text.indexOf(marker);
  if (at === -1) throw new Error('manifest.json: could not find end of skills array');
  const body = JSON.stringify(entry, null, 2).split('\n').map((l) => `    ${l}`).join('\n');
  return `${text.slice(0, at)},\n${body}${text.slice(at)}`;
}

// Pin the skill count in the integrity test to the new total.
export function bumpPinnedCount(testSrc, newCount) {
  const re = /(manifest\.skills\.length, )\d+(, 'manifest\.skills must contain exactly )\d+( skills')/;
  if (!re.test(testSrc)) throw new Error('integrity test: pinned count assertion not found');
  return testSrc.replace(re, `$1${newCount}$2${newCount}$3`);
}

export function renderSkillMd({ id, description, trigger }) {
  return `---
name: ${id}
description: ${description} Use whenever the user says ${trigger}.
compatibility: |
  - Runtime: Node.js 18+
  - Dependencies: none
  - Permissions: read:repo
---

# ${titleCase(id)}

TODO: one or two sentences on why this skill exists.

## Trigger

${trigger}.

## Steps

1. **TODO.** Say what to do and why it matters.

## Input Schema

\`\`\`typescript
interface Input {}
\`\`\`

## Output Schema

\`\`\`typescript
interface Output { summary: string }
\`\`\`

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See ${GUIDE_LINK}**
`;
}

export function renderReadme({ id, description }) {
  return `# ${titleCase(id)}

${description}

## Quick start

TODO: one line on how to invoke it.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See ${GUIDE_LINK}.
`;
}

export const lineCount = (s) => String(s).split('\n').length - (String(s).endsWith('\n') ? 1 : 0);

// Fails when a doc is at or over its line limit. README < 100, SKILL.md < 150.
export function checkDocLimits({ readme, skillMd }) {
  const problems = [];
  if (lineCount(readme) >= README_MAX) problems.push(`README.md has ${lineCount(readme)} lines; limit is under ${README_MAX}`);
  if (lineCount(skillMd) >= SKILL_MD_MAX) problems.push(`SKILL.md has ${lineCount(skillMd)} lines; limit is under ${SKILL_MD_MAX}`);
  return problems;
}

// Write the skill dir. Refuses to overwrite. USAGE.md only when the skill has more than 3 steps.
export function scaffoldSkill(repoRoot, opts, fsImpl = fs) {
  const dir = path.join(repoRoot, 'skills', opts.id);
  const v = validateSkillId(opts.id, fsImpl.existsSync(dir) ? [opts.id] : []);
  if (!v.ok) throw new Error(v.reason);
  const files = {
    'skill.json': renderSkillJson(opts),
    'SKILL.md': renderSkillMd({ ...opts, trigger: opts.trigger ?? `"${opts.id.replace(/-/g, ' ')}"` }),
    'README.md': renderReadme(opts),
    'src/index.mjs': "export function run() {\n  return { summary: 'TODO' };\n}\n",
    'tests/index.test.mjs': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { run } from '../src/index.mjs';\n\ntest('run returns a summary', () => {\n  assert.ok(run().summary);\n});\n",
  };
  if ((opts.steps ?? 0) > 3) files['docs/USAGE.md'] = `# ${titleCase(opts.id)}: usage\n\n## Examples\n\nTODO\n\n## Troubleshooting\n\nTODO\n`;
  const problems = checkDocLimits({ readme: files['README.md'], skillMd: files['SKILL.md'] });
  if (problems.length) throw new Error(problems.join('; '));
  for (const [rel, body] of Object.entries(files)) {
    fsImpl.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fsImpl.writeFileSync(path.join(dir, rel), body);
  }
  return Object.keys(files).sort();
}

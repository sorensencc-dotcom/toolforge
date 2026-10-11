import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import { validateInvocationInput, inspectInvocation, classifyInvocationResult, getInvocationDescriptor } from '../src/invocation-contracts.mjs';
import roadmap from '../../roadmap-validator/src/index.ts';
import { detectDrift } from '../../agent-drift-detector/src/index.ts';
import { validateFiles } from '../../retro-schema-validator/src/index.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const context = { toolforgeRoot: root, manifestPath: path.join(root, 'manifest.json'), nodeExecutable: process.execPath };
const retro = { date: '2026-10-09', type: 'weekly', metrics: { unit_scale: 80, active_days: 5, commits_authored: 1, issues_closed: 0 }, sections: { wins: [], blockers: [], next: [] }, notes: '' };
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(root, '.pilot-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ctx = { ...context, workspaceRoots: [dir] };
  async function write(name, content) { const file = path.join(dir, name); await fs.writeFile(file, content); return file; }
  return { dir, ctx, write };
}
const invalid = (error) => error.code === 'INVALID_INPUT' && typeof error.fieldErrors === 'object';

test('Roadmap defaults, strict types, unknown fields, and real outcomes', async t => {
  const { ctx, write } = await fixture(t);
  const file = await write('valid.md', '# Roadmap\n<!-- SYNC:TOOLFORGE -->\nWork\n<!-- END:SYNC -->');
  const normalized = await validateInvocationInput('roadmap-validator', { roadmapPath: file }, ctx);
  assert.deepEqual(normalized, { input: { roadmapPath: await fs.realpath(file), strict: false, verbose: false }, readFiles: [await fs.realpath(file)] });
  for (const input of [null, [], {}, { roadmapPath: file, strict: 1 }, { roadmapPath: file, verbose: 'false' }, { roadmapPath: file, extra: true }]) {
    await assert.rejects(validateInvocationInput('roadmap-validator', input, ctx), invalid);
  }
  assert.equal(classifyInvocationResult('roadmap-validator', await roadmap(normalized.input)), 'pass');
  for (const text of ['# Missing', '# Reversed\n<!-- END:SYNC -->\nx\n<!-- SYNC:TOOLFORGE -->']) {
    await fs.writeFile(file, text);
    const input = (await validateInvocationInput('roadmap-validator', { roadmapPath: file }, ctx)).input;
    assert.equal(classifyInvocationResult('roadmap-validator', await roadmap(input)), 'findings');
    const strict = await roadmap({ ...input, strict: true });
    assert.equal(classifyInvocationResult('roadmap-validator', strict), 'findings');
    assert.equal(Object.hasOwn(strict, 'data'), false);
    assert.equal(classifyInvocationResult('roadmap-validator', await roadmap({ ...input, verbose: true })), 'findings');
  }
});

test('Agent uses actual export, trimmed name, object schemas, and top-level keys', async () => {
  for (const [expectedSchema, actualSchema, outcome] of [[{}, {}, 'pass'], [{ a: { x: 1 } }, { a: null }, 'pass'], [{ a: 1 }, {}, 'findings'], [{}, { z: 1 }, 'findings']]) {
    const { input, readFiles } = await validateInvocationInput('agent-drift-detector', { agentName: ' agent ', expectedSchema, actualSchema }, context);
    assert.equal(input.agentName, 'agent'); assert.deepEqual(readFiles, []);
    assert.equal(classifyInvocationResult('agent-drift-detector', detectDrift(input)), outcome);
  }
  for (const field of ['expectedSchema', 'actualSchema']) for (const bad of [null, [], true, 'schema', 1]) {
    await assert.rejects(validateInvocationInput('agent-drift-detector', { agentName: 'a', expectedSchema: {}, actualSchema: {}, [field]: bad }, context), invalid);
  }
  for (const input of [{ agentName: ' ', expectedSchema: {}, actualSchema: {} }, { agentName: 'a', expectedSchema: {}, actualSchema: [], strict: true }, { expectedSchema: {}, observedOutput: {} }]) {
    await assert.rejects(validateInvocationInput('agent-drift-detector', input, context), invalid);
  }
  const doc = await fs.readFile(path.join(root, 'skills/agent-drift-detector/SKILL.md'), 'utf8');
  assert.match(doc, /actualSchema/); assert.match(doc, /agentName/); assert.match(doc, /driftDetected/);
  assert.doesNotMatch(doc, /observedOutput|unexpectedFields|strict\?/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(validateInvocationInput('agent-drift-detector', {}, { ...context, signal: controller.signal }), e => e.code === 'CANCELLED');
  for (const value of [NaN, undefined, () => {}, new Date()]) {
    await assert.rejects(validateInvocationInput('agent-drift-detector', { agentName: 'a', expectedSchema: { value }, actualSchema: {} }, context), invalid);
  }
  const sized = { agentName: 'a', expectedSchema: { huge: '' }, actualSchema: {} };
  sized.expectedSchema.huge = 'x'.repeat(65536 - Buffer.byteLength(JSON.stringify(sized)));
  await validateInvocationInput('agent-drift-detector', sized, context);
  sized.expectedSchema.huge += 'x';
  await assert.rejects(validateInvocationInput('agent-drift-detector', sized, context), e => e.code === 'INPUT_TOO_LARGE');
});

test('Retro accepts 1/32, rejects 0/33 and duplicate identities, retains order', async t => {
  const { ctx, write } = await fixture(t);
  const files = [];
  for (let i = 0; i < 32; i++) files.push(await write(`${i}.json`, JSON.stringify(retro)));
  for (const filePaths of [[files[0]], [...files].reverse()]) {
    const result = await validateInvocationInput('retro-schema-validator', { filePaths }, ctx);
    assert.deepEqual(result.input.filePaths, await Promise.all(filePaths.map(f => fs.realpath(f))));
    assert.deepEqual(result.readFiles, result.input.filePaths);
    assert.equal(classifyInvocationResult('retro-schema-validator', validateFiles(result.readFiles)), 'pass');
  }
  for (const filePaths of [[], [...files, files[0]], [files[0], files[0].toUpperCase()]]) {
    await assert.rejects(validateInvocationInput('retro-schema-validator', { filePaths }, ctx), invalid);
  }
  const ordered = [await write('warning.json', JSON.stringify({ ...retro, extra: 1 })), await write('error.json', '{}'), await write('bad.json', '{broken')];
  const native = validateFiles(ordered);
  assert.equal(classifyInvocationResult('retro-schema-validator', native), 'findings');
  assert.deepEqual([...new Set(native.violations.map(v => v.file))], ordered);
  for (const value of [null, [], 'x', 1, true, false]) {
    const result = validateFiles([await write('root.json', JSON.stringify(value))]);
    assert.equal(result.violations[0].field, 'root');
    assert.equal(classifyInvocationResult('retro-schema-validator', result), 'findings');
  }
});

test('path containment, syntax, file kind, readability, and exact size limits', async t => {
  const { dir, ctx, write } = await fixture(t);
  const file = await write('size.md', Buffer.alloc(1024 * 1024));
  await validateInvocationInput('roadmap-validator', { roadmapPath: file }, ctx);
  await fs.appendFile(file, 'x');
  await assert.rejects(validateInvocationInput('roadmap-validator', { roadmapPath: file }, ctx), invalid);
  const bad = ['relative.md', path.join(dir, 'missing.md'), dir, `${dir}/../outside.md`, '\\\\server\\share\\x.md', '\\\\?\\C:\\x.md', '\\\\.\\C:\\x.md', 'C:\\x.md:stream', 'C:\\con.md', path.join(dir, 'wrong.json')];
  for (const roadmapPath of bad) await assert.rejects(validateInvocationInput('roadmap-validator', { roadmapPath }, ctx), invalid);
  const outside = await fs.mkdtemp(path.join(root, '.pilot-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'escape.md'), '#');
  await fs.symlink(outside, path.join(dir, 'junction'), 'junction');
  await assert.rejects(validateInvocationInput('roadmap-validator', { roadmapPath: path.join(dir, 'junction/escape.md') }, ctx), invalid);
  await fs.symlink(dir, path.join(dir, 'alias'), 'junction');
  const json = await write('a.json', '{}');
  await fs.mkdir(path.join(dir, 'directory.md'));
  await assert.rejects(validateInvocationInput('roadmap-validator', { roadmapPath: path.join(dir, 'directory.md') }, ctx), invalid);
  const readable = await write('readable.md', '# Roadmap');
  const originalOpen = fs.open;
  fs.open = async () => { throw Object.assign(new Error('private filesystem detail'), { code: 'EACCES' }); };
  syncBuiltinESMExports();
  try {
    await assert.rejects(validateInvocationInput('roadmap-validator', { roadmapPath: readable }, ctx), e => invalid(e) && !JSON.stringify(e.fieldErrors).includes('private'));
  } finally { fs.open = originalOpen; syncBuiltinESMExports(); }
  await assert.rejects(validateInvocationInput('retro-schema-validator', { filePaths: [json, path.join(dir, 'alias/a.json')] }, ctx), invalid);
  await assert.rejects(validateInvocationInput('agent-drift-detector', { agentName: 'a', expectedSchema: { huge: '\u00e9'.repeat(32768) }, actualSchema: {} }, context), e => e.code === 'INPUT_TOO_LARGE');
  await assert.rejects(validateInvocationInput('unknown', {}, ctx), e => e.code === 'INVALID_TARGET');
});

test('strict native result shapes reject malformed and inconsistent outputs', () => {
  for (const skill of ['roadmap-validator', 'agent-drift-detector', 'retro-schema-validator']) {
    for (const result of [null, [], {}, { status: 'success' }]) assert.throws(() => classifyInvocationResult(skill, result), e => e.code === 'INVALID_RESULT');
  }
  assert.throws(() => classifyInvocationResult('roadmap-validator', { status: 'error', message: 'failed', code: 'SKILL_ERROR' }), e => e.code === 'SKILL_ERROR');
  assert.throws(() => classifyInvocationResult('agent-drift-detector', { agentName: 'a', driftDetected: false, missingFields: ['x'], extraFields: [], recommendations: [] }), e => e.code === 'INVALID_RESULT');
  assert.throws(() => classifyInvocationResult('retro-schema-validator', { status: 'success', verdict: 'GREEN', filesValidated: 1, violations: [{ file: 'x', field: 'x', level: 'error', message: 'x' }], timestamp: new Date().toISOString() }), e => e.code === 'INVALID_RESULT');
  assert.throws(() => classifyInvocationResult('roadmap-validator', { status: 'error', message: 'inconsistent', data: { isValid: true, findings: [], syncMarkersPresent: true, contentLength: 1, validated: new Date().toISOString() } }), e => e.code === 'INVALID_RESULT');
});

test('review anchor excludes self, enables reviewed runners, and fails closed on incomplete review or drift', async t => {
  const { dir } = await fixture(t);
  const reviewed = JSON.parse(await fs.readFile(path.join(root, 'skills/toolforge-cli/src/invocation-reviewed.json')));
  assert.ok(Object.hasOwn(reviewed.files, 'skills/toolforge-cli/SKILL.json'));
  assert.ok(reviewed.shared.includes('skills/toolforge-cli/SKILL.json'));
  assert.equal(Object.hasOwn(reviewed.files, 'skills/toolforge-cli/skill.json'), false);
  assert.equal(reviewed.shared.includes('skills/toolforge-cli/skill.json'), false);
  assert.equal(Object.hasOwn(reviewed.files, 'skills/toolforge-cli/src/invocation-reviewed.json'), false);
  for (const name of ['invocation-contracts.mjs', 'invoke-skill.mjs', 'invocation-worker.mjs']) assert.ok(Object.hasOwn(reviewed.files, `skills/toolforge-cli/src/${name}`));
  const copied = path.join(dir, 'copy'); await fs.mkdir(copied);
  for (const [relative, digest] of Object.entries(reviewed.files)) {
    if (!digest) continue;
    const target = path.join(copied, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(path.join(root, relative), target);
  }
  const ctx = { ...context, toolforgeRoot: copied, manifestPath: path.join(copied, 'manifest.json') };
  const baseline = await inspectInvocation('roadmap-validator', ctx);
  assert.equal(baseline.available, true); assert.equal(baseline.reason, null);
  for (const incomplete of ['null', 'missing']) {
    const fixtureRoot = path.join(dir, incomplete); await fs.cp(copied, fixtureRoot, { recursive: true });
    const fixtureAnchor = structuredClone(reviewed);
    const runnerPath = 'skills/toolforge-cli/src/invoke-skill.mjs';
    if (incomplete === 'null') fixtureAnchor.files[runnerPath] = null;
    else delete fixtureAnchor.files[runnerPath];
    await fs.writeFile(path.join(fixtureRoot, 'skills/toolforge-cli/src/invocation-reviewed.json'), JSON.stringify(fixtureAnchor));
    const fixtureContracts = await import(pathToFileURL(path.join(fixtureRoot, 'skills/toolforge-cli/src/invocation-contracts.mjs')).href);
    const unavailable = await fixtureContracts.inspectInvocation('roadmap-validator', { ...context, toolforgeRoot: fixtureRoot, manifestPath: path.join(fixtureRoot, 'manifest.json') });
    assert.equal(unavailable.available, false); assert.equal(unavailable.reason, 'REVIEW_INCOMPLETE');
  }
  for (const relative of ['skills/roadmap-validator/src/index.ts', 'skills/toolforge-cli/src/invocation-contracts.mjs', 'skills/toolforge-cli/SKILL.json', 'skills/roadmap-validator/package.json', 'skills/roadmap-validator/skill.json', 'manifest.json']) {
    const file = path.join(copied, relative); const original = await fs.readFile(file);
    await fs.appendFile(file, '\n/* changed handler must never execute */');
    assert.equal((await inspectInvocation('roadmap-validator', ctx)).reason, 'SOURCE_DRIFT', relative);
    await fs.writeFile(file, original);
  }
  const handler = path.join(copied, 'skills/roadmap-validator/src/index.ts');
  const source = await fs.readFile(handler);
  const marker = path.join(dir, 'handler-executed');
  await fs.writeFile(path.join(copied, 'skills/roadmap-validator/src/unreviewed.mjs'), `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'executed');`);
  await fs.appendFile(handler, '\nimport "./unreviewed.mjs";');
  assert.equal((await inspectInvocation('roadmap-validator', ctx)).reason, 'SOURCE_DRIFT');
  await assert.rejects(fs.stat(marker), e => e.code === 'ENOENT');
  await fs.writeFile(handler, source);
  await fs.writeFile(path.join(copied, 'skills/roadmap-validator/src/package.json'), '{}');
  assert.equal((await inspectInvocation('roadmap-validator', ctx)).reason, 'SOURCE_DRIFT');
  await fs.unlink(path.join(copied, 'skills/roadmap-validator/src/package.json'));
  await fs.writeFile(path.join(copied, 'skills/toolforge-cli/src/invoke-skill.mjs'), 'throw new Error("must not execute")');
  assert.equal((await inspectInvocation('roadmap-validator', ctx)).available, false);
  const manifest = JSON.parse(await fs.readFile(ctx.manifestPath));
  manifest.skills.find(s => s.id === 'roadmap-validator').entrypoint = 'src/changed.ts';
  await fs.writeFile(ctx.manifestPath, JSON.stringify(manifest));
  assert.equal((await inspectInvocation('roadmap-validator', ctx)).available, false);
  await assert.rejects(validateInvocationInput('roadmap-validator', {}, ctx), e => e.code === 'REGISTRY_DRIFT');
  assert.equal(getInvocationDescriptor('agent-drift-detector').exportName, 'detectDrift');
  assert.equal(getInvocationDescriptor('retro-schema-validator').argument, 'filePaths');
});

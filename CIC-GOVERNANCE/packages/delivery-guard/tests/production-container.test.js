import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const composeFile = path.join(repositoryRoot, 'docker-compose.prod.yml');

test('Governance CI always executes bounded production container regressions', () => {
  const workflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/governance.yml'), 'utf8');
  assert.match(workflow, /run: timeout 60s node --test --test-timeout=30000 CIC-GOVERNANCE\/packages\/delivery-guard\/tests\/production-container\.test\.js/);
});

function temporaryDirectory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-container-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function composeConfig(t, password) {
  const root = temporaryDirectory(t);
  const envFile = path.join(root, 'empty.env');
  fs.writeFileSync(envFile, '');
  const env = { ...process.env };
  delete env.POSTGRES_PASSWORD;
  if (password !== undefined) env.POSTGRES_PASSWORD = password;
  return spawnSync('docker', ['compose', '--env-file', envFile, '-f', composeFile, 'config', '--format', 'json'], {
    cwd: repositoryRoot, env, encoding: 'utf8', timeout: 20_000,
  });
}

for (const [label, password] of [['missing', undefined], ['empty', '']]) {
  test(`production Compose refuses ${label} database credentials`, (t) => {
    const result = composeConfig(t, password);
    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /POSTGRES_PASSWORD/);
  });
}

test('production Compose uses the supplied database password consistently', (t) => {
  const password = randomBytes(24).toString('hex');
  const result = composeConfig(t, password);
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.services.postgres.environment.POSTGRES_PASSWORD, password);
  assert.equal(new URL(config.services.api.environment.DATABASE_URL).password, password);
});

test('Docker context retains the SQL migrations used by npm run migrate', () => {
  const migrations = path.join(repositoryRoot, 'src/db/migrations');
  assert.ok(fs.readdirSync(migrations).some((name) => name.endsWith('.sql')));
  const rules = fs.readFileSync(path.join(repositoryRoot, '.dockerignore'), 'utf8').split(/\r?\n/);
  assert.ok(rules.lastIndexOf('!src/db/migrations/*.sql') > rules.lastIndexOf('*.sql'),
    'migration exception must follow the blanket SQL exclusion');
});

test('Docker UI build propagates compiler failures instead of producing a broken image', (t) => {
  const root = temporaryDirectory(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'ui:build': 'node fail.cjs' } }));
  fs.writeFileSync(path.join(root, 'fail.cjs'), 'process.exit(17);\n');
  const dockerfile = fs.readFileSync(path.join(repositoryRoot, 'Dockerfile'), 'utf8');
  const command = dockerfile.match(/^RUN (npm run ui:build[^\r\n]*)/m)[1];
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const result = spawnSync(bash, ['-c', command], { cwd: root, encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.status, 17, result.stderr);
});

test('Docker dependency installation works with and without a root lockfile', (t) => {
  const root = temporaryDirectory(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'container-regression-fixture', version: '1.0.0', private: true }));
  const dockerfile = fs.readFileSync(path.join(repositoryRoot, 'Dockerfile'), 'utf8');
  const command = dockerfile.match(/^RUN ((?:npm ci|if \[ -f package-lock\.json \])[^\r\n]*)/m)[1];
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const run = () => spawnSync(bash, ['-c', command], { cwd: root, encoding: 'utf8', timeout: 15_000 });
  const withoutLock = run();
  assert.equal(withoutLock.status, 0, withoutLock.stderr);
  assert.ok(fs.existsSync(path.join(root, 'package-lock.json')));
  const withLock = run();
  assert.equal(withLock.status, 0, withLock.stderr);
});

test('Kubernetes secret template does not contain hardcoded credentials', () => {
  const secretYaml = fs.readFileSync(path.join(repositoryRoot, 'k8s/secret.yaml'), 'utf8');
  assert.equal(secretYaml.includes('postgres:postgres'), false, 'must not contain default credentials');
  assert.match(secretYaml, /DATABASE_URL:\s*""/, 'DATABASE_URL should be an empty deployment placeholder');
});


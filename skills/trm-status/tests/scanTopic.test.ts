import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findAllTopics, scanTopicDir, deriveStatus } from '../src/scanTopic';

function writeTopicJson(dir: string, overrides: Partial<Record<string, unknown>> = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'topic.json'),
    JSON.stringify({
      topic: path.basename(dir),
      path: dir,
      updated_at: new Date().toISOString(),
      ...overrides,
    })
  );
}

function makeFile(dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), 'x');
}

describe('trm-status scanner', () => {
  let vaultRoot: string;

  beforeEach(() => {
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-status-test-'));
  });

  afterEach(() => {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  });

  test('findAllTopics finds leaf topics but not container nodes', () => {
    const person = path.join(vaultRoot, 'topics', 'charlie');
    writeTopicJson(person); // container — no sources dir
    const stub = path.join(person, 'stub-trm');
    writeTopicJson(stub);
    fs.mkdirSync(path.join(stub, 'sources'), { recursive: true });

    const found = findAllTopics(vaultRoot);
    expect(found).toEqual([stub]);
  });

  test('a topic with zero sources is a stub', () => {
    const dir = path.join(vaultRoot, 'topics', 'charlie', 'cuba');
    writeTopicJson(dir);
    fs.mkdirSync(path.join(dir, 'sources'), { recursive: true });

    const stats = scanTopicDir(dir);
    const status = deriveStatus(stats);
    expect(status.state).toBe('stub');
    expect(status.nextSteps[0]).toMatch(/no sources yet/i);
  });

  test('a topic with an unfinished staging batch is staging-pending', () => {
    const dir = path.join(vaultRoot, 'topics', 'charlie', 'benson-ford');
    writeTopicJson(dir);
    makeFile(path.join(dir, 'sources'), 'a.jpg');
    makeFile(path.join(dir, 'sources'), 'b.jpg');
    fs.mkdirSync(path.join(dir, '_staging-batch7'), { recursive: true });

    const status = deriveStatus(scanTopicDir(dir));
    expect(status.state).toBe('staging-pending');
    expect(status.nextSteps[0]).toMatch(/_staging-batch7/);
  });

  test('a topic with leftover but fully-processed staging batches is active with a cleanup note', () => {
    const dir = path.join(vaultRoot, 'topics', 'charlie', 'benson-ford');
    writeTopicJson(dir);
    makeFile(path.join(dir, 'sources'), 'a.jpg');
    makeFile(path.join(dir, 'extracts'), 'a.json');
    fs.mkdirSync(path.join(dir, '_staging-batch1'), { recursive: true });

    const status = deriveStatus(scanTopicDir(dir));
    expect(status.state).toBe('active');
    expect(status.nextSteps[0]).toMatch(/safe to archive\/delete/);
  });

  test('a topic where extracts lag far behind sources is extract-lag', () => {
    const dir = path.join(vaultRoot, 'topics', 'charlie', 'willow-run');
    writeTopicJson(dir);
    for (let i = 0; i < 10; i++) makeFile(path.join(dir, 'sources'), `s${i}.jpg`);
    makeFile(path.join(dir, 'extracts'), 'e0.json');

    const status = deriveStatus(scanTopicDir(dir));
    expect(status.state).toBe('extract-lag');
    expect(status.nextSteps[0]).toMatch(/1\/10/);
  });

  test('a fully caught-up recently-updated topic is active', () => {
    const dir = path.join(vaultRoot, 'topics', 'charlie', 'michigan-flight-museum');
    writeTopicJson(dir, { updated_at: new Date().toISOString() });
    makeFile(path.join(dir, 'sources'), 's0.jpg');
    makeFile(path.join(dir, 'extracts'), 'e0.json');

    const status = deriveStatus(scanTopicDir(dir));
    expect(status.state).toBe('active');
    expect(status.nextSteps).toEqual([]);
  });

  test('a caught-up but long-untouched topic is stale', () => {
    const dir = path.join(vaultRoot, 'topics', 'charlie', 'old-trm');
    const old = new Date();
    old.setDate(old.getDate() - 30);
    writeTopicJson(dir, { updated_at: old.toISOString() });
    makeFile(path.join(dir, 'sources'), 's0.jpg');
    makeFile(path.join(dir, 'extracts'), 'e0.json');

    const status = deriveStatus(scanTopicDir(dir));
    expect(status.state).toBe('stale');
    expect(status.staleDays).toBeGreaterThanOrEqual(30);
  });
});

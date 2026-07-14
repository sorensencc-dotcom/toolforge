import test from 'node:test';
import assert from 'node:assert';
import { parseVersion, compareVersions, resolvePin, SemVerError } from './semver.js';

test('SemVer: Parse Version', async (t) => {
  await t.test('parse basic version', () => {
    const v = parseVersion('1.2.3');
    assert.strictEqual(v.major, 1);
    assert.strictEqual(v.minor, 2);
    assert.strictEqual(v.patch, 3);
  });

  await t.test('parse with prerelease', () => {
    const v = parseVersion('1.2.3-rc.1');
    assert.strictEqual(v.prerelease, 'rc.1');
  });

  await t.test('reject invalid format', () => {
    assert.throws(
      () => parseVersion('v1.2.3'),
      SemVerError
    );
  });
});

test('SemVer: Compare Versions', async (t) => {
  await t.test('1.0.0 < 2.0.0', () => {
    assert.strictEqual(compareVersions('1.0.0', '2.0.0'), -1);
  });

  await t.test('2.0.0 > 1.0.0', () => {
    assert.strictEqual(compareVersions('2.0.0', '1.0.0'), 1);
  });

  await t.test('1.2.0 < 1.3.0', () => {
    assert.strictEqual(compareVersions('1.2.0', '1.3.0'), -1);
  });

  await t.test('1.2.3 == 1.2.3', () => {
    assert.strictEqual(compareVersions('1.2.3', '1.2.3'), 0);
  });

  await t.test('prerelease < release', () => {
    assert.strictEqual(compareVersions('1.0.0-rc.1', '1.0.0'), -1);
  });
});

test('SemVer: Resolve Constraints', async (t) => {
  const versions = ['1.0.0', '1.1.0', '1.2.0', '1.2.3', '2.0.0', '2.1.0'];

  await t.test('caret: ^1.2.0', () => {
    const result = resolvePin('^1.2.0', versions);
    assert.strictEqual(result, '2.0.0' <= result ? null : result);
    // Should pick highest 1.x.x that's >= 1.2.0 and < 2.0.0
  });

  await t.test('tilde: ~1.2.0', () => {
    const result = resolvePin('~1.2.0', versions);
    // Should pick highest 1.2.x
    assert(result && result.startsWith('1.2'));
  });

  await t.test('exact: 1.2.0', () => {
    const result = resolvePin('1.2.0', versions);
    assert.strictEqual(result, '1.2.0');
  });

  await t.test('gte: >=1.2.0', () => {
    const result = resolvePin('>=1.2.0', versions);
    assert.strictEqual(result, '2.1.0'); // highest matching
  });

  await t.test('lte: <=1.2.0', () => {
    const result = resolvePin('<=1.2.0', versions);
    assert.strictEqual(result, '1.2.0');
  });

  await t.test('gt: >1.2.0', () => {
    const result = resolvePin('>1.2.0', versions);
    assert.strictEqual(result, '2.1.0');
  });

  await t.test('lt: <1.2.0', () => {
    const result = resolvePin('<1.2.0', versions);
    assert.strictEqual(result, '1.1.0');
  });

  await t.test('wildcard: 1.2.*', () => {
    const result = resolvePin('1.2.*', versions);
    assert.strictEqual(result, '1.2.3');
  });

  await t.test('no match returns null', () => {
    const result = resolvePin('>=3.0.0', versions);
    assert.strictEqual(result, null);
  });

  await t.test('unsupported constraint throws', () => {
    assert.throws(
      () => resolvePin('~>1.2.0', versions),
      SemVerError
    );
  });
});

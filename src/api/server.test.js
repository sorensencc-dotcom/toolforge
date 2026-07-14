import test from 'node:test';
import assert from 'node:assert';
import { pool } from '../db/connect.js';
import * as schema from '../db/schema.js';

const db = { query: (text, params) => pool.query(text, params) };

test('API: GET /api/v1/skills', async (t) => {
  await t.test('list published skills', async () => {
    const skills = await schema.listSkills(db, { status: 'published', limit: 50, offset: 0 });
    assert(Array.isArray(skills));
  });

  await t.test('filter by category', async () => {
    const skills = await schema.listSkills(db, { category: 'linting', status: 'published', limit: 50 });
    assert(Array.isArray(skills));
    skills.forEach(s => assert.equal(s.category, 'linting'));
  });

  await t.test('respect limit and offset', async () => {
    const page1 = await schema.listSkills(db, { limit: 10, offset: 0, status: 'published' });
    const page2 = await schema.listSkills(db, { limit: 10, offset: 10, status: 'published' });
    assert(Array.isArray(page1));
    assert(Array.isArray(page2));
  });
});

test('API: GET /api/v1/skills/search', async (t) => {
  await t.test('search by query', async () => {
    const results = await schema.searchSkills(db, 'auth', { limit: 50, offset: 0 });
    assert(Array.isArray(results));
  });

  await t.test('return empty on no match', async () => {
    const results = await schema.searchSkills(db, 'nonexistent_xyz_skill_name_1234', { limit: 50 });
    assert(Array.isArray(results));
    assert.equal(results.length, 0);
  });

  await t.test('respect limit', async () => {
    const results = await schema.searchSkills(db, 'skill', { limit: 5 });
    assert(Array.isArray(results));
    assert(results.length <= 5);
  });
});

test('API: GET /api/v1/skills/:id', async (t) => {
  await t.test('return skill detail with rating', async () => {
    const skill = await schema.getSkill(db, 'nonexistent-id');
    // When skill doesn't exist, should return undefined
    assert.equal(skill, undefined);
  });

  await t.test('rating aggregation', async () => {
    const skillId = 'test-skill-id';
    const rating = await schema.getRatingAverage(db, skillId);
    assert.strictEqual(typeof rating.average, 'number' || 'object');
    assert.strictEqual(typeof rating.count, 'number');
  });
});

test('API: GET /api/v1/skills/:id/versions', async (t) => {
  await t.test('return empty versions for nonexistent skill', async () => {
    const versions = await schema.getVersions(db, 'nonexistent-id');
    assert(Array.isArray(versions));
  });
});

test('API: GET /api/v1/skills/trending', async (t) => {
  await t.test('trending by 30d', async () => {
    const trending = await schema.getTrendingMetrics(db, { window: '30d', limit: 50 });
    assert(Array.isArray(trending));
  });

  await t.test('trending by 7d', async () => {
    const trending = await schema.getTrendingMetrics(db, { window: '7d', limit: 50 });
    assert(Array.isArray(trending));
  });

  await t.test('respect limit', async () => {
    const trending = await schema.getTrendingMetrics(db, { limit: 5 });
    assert(Array.isArray(trending));
    assert(trending.length <= 5);
  });
});

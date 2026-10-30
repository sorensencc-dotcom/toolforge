import { seedInstalls } from './src/e2e/harness.js';
import pg from 'pg';

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = { query: (text, params) => pool.query(text, params) };

  const skillRes = await pool.query(
    `INSERT INTO skills (name, category, description, owner, manifest_json, status)
     VALUES ('test', 'test', 'test', 'test', '{}', 'published') RETURNING id`
  );
  const skillId = skillRes.rows[0].id;

  const versionRes = await pool.query(
    `INSERT INTO versions (skill_id, version_tag, release_date, changelog, checksum)
     VALUES ($1, '1.0', NOW(), 'test', 'chk') RETURNING id`,
    [skillId]
  );
  const versionId = versionRes.rows[0].id;

  const start = Date.now();
  await seedInstalls(db, skillId, versionId, 'run_1', 1000);
  const ms = Date.now() - start;

  console.log(`Seeded 1000 installs in ${ms}ms`);

  await pool.end();
}

run().catch(console.error);

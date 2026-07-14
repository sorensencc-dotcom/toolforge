// Phase 9 Marketplace Database Schema Definitions

export const schema = {
  skills: {
    columns: ['id', 'name', 'category', 'description', 'icon_url', 'owner', 'manifest_json', 'status', 'created_at', 'updated_at'],
    table: 'skills',
    pk: 'id',
    indexes: ['category', 'owner', 'status', 'created_at', 'name_trgm'],
  },
  versions: {
    columns: ['id', 'skill_id', 'version_tag', 'release_date', 'changelog', 'checksum', 'status', 'created_at'],
    table: 'versions',
    pk: 'id',
    fk: { skill_id: 'skills(id)' },
    indexes: ['skill_id', 'version_tag', 'status', 'skill_tag'],
  },
  ratings: {
    columns: ['id', 'skill_id', 'user_id', 'score', 'review_text', 'created_at', 'updated_at'],
    table: 'ratings',
    pk: 'id',
    fk: { skill_id: 'skills(id)' },
    indexes: ['skill_id', 'user_id', 'score', 'created_at'],
    unique: ['skill_id, user_id'],
  },
  trending_metrics: {
    columns: ['id', 'skill_id', 'installs_7d', 'installs_30d', 'rating_avg', 'rating_count', 'trend_direction', 'calculated_at'],
    table: 'trending_metrics',
    pk: 'id',
    fk: { skill_id: 'skills(id)' },
    indexes: ['installs_7d', 'installs_30d', 'rating_avg', 'calculated_at'],
  },
  installation_log: {
    columns: ['id', 'skill_id', 'version_id', 'user_id', 'timestamp', 'status', 'error_message'],
    table: 'installation_log',
    pk: 'id',
    fk: { skill_id: 'skills(id)', version_id: 'versions(id)' },
    indexes: ['skill_id', 'version_id', 'timestamp', 'status'],
  },
};

// Helper: Insert skill
export async function insertSkill(db, { name, category, description, icon_url, owner, manifest_json }) {
  const query = `
    INSERT INTO skills (name, category, description, icon_url, owner, manifest_json)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await db.query(query, [name, category, description, icon_url, owner, JSON.stringify(manifest_json)]);
  return result.rows[0];
}

// Helper: Get skill by ID
export async function getSkill(db, skillId) {
  const query = 'SELECT * FROM skills WHERE id = $1';
  const result = await db.query(query, [skillId]);
  return result.rows[0];
}

// Helper: Get skill by name
export async function getSkillByName(db, name) {
  const query = 'SELECT * FROM skills WHERE name = $1';
  const result = await db.query(query, [name]);
  return result.rows[0];
}

// Helper: List skills (paginated)
export async function listSkills(db, { category, status = 'published', limit = 50, offset = 0, sort = 'created_at' } = {}) {
  let query = 'SELECT * FROM skills WHERE status = $1';
  const params = [status];

  if (category) {
    query += ` AND category = $${params.length + 1}`;
    params.push(category);
  }

  const validSorts = ['created_at', 'updated_at', 'name'];
  const sortColumn = validSorts.includes(sort) ? sort : 'created_at';
  query += ` ORDER BY ${sortColumn} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

// Helper: Search skills by name/description
export async function searchSkills(db, searchQuery, { limit = 50, offset = 0 } = {}) {
  const query = `
    SELECT * FROM skills
    WHERE to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')) @@
          plainto_tsquery('english', $1)
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await db.query(query, [searchQuery, limit, offset]);
  return result.rows;
}

// Helper: Get versions for skill
export async function getVersions(db, skillId) {
  const query = 'SELECT * FROM versions WHERE skill_id = $1 ORDER BY release_date DESC';
  const result = await db.query(query, [skillId]);
  return result.rows;
}

// Helper: Get specific version
export async function getVersion(db, skillId, versionTag) {
  const query = 'SELECT * FROM versions WHERE skill_id = $1 AND version_tag = $2';
  const result = await db.query(query, [skillId, versionTag]);
  return result.rows[0];
}

// Helper: Insert version
export async function insertVersion(db, { skill_id, version_tag, release_date, changelog, checksum }) {
  const query = `
    INSERT INTO versions (skill_id, version_tag, release_date, changelog, checksum)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await db.query(query, [skill_id, version_tag, release_date, changelog, checksum]);
  return result.rows[0];
}

// Helper: Get ratings for skill
export async function getRatings(db, skillId) {
  const query = `
    SELECT score, COUNT(*) as count, AVG(score::numeric) as average
    FROM ratings
    WHERE skill_id = $1
    GROUP BY score
    ORDER BY score DESC
  `;
  const result = await db.query(query, [skillId]);
  return result.rows;
}

// Helper: Get rating average for skill
export async function getRatingAverage(db, skillId) {
  const query = `
    SELECT AVG(score::numeric) as average, COUNT(*) as count
    FROM ratings
    WHERE skill_id = $1
  `;
  const result = await db.query(query, [skillId]);
  const row = result.rows[0];
  return {
    average: row.average ? parseFloat(row.average) : null,
    count: parseInt(row.count),
  };
}

// Helper: Insert rating
export async function insertRating(db, { skill_id, user_id, score, review_text }) {
  const query = `
    INSERT INTO ratings (skill_id, user_id, score, review_text)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (skill_id, user_id) DO UPDATE SET
      score = $3,
      review_text = $4,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await db.query(query, [skill_id, user_id, score, review_text]);
  return result.rows[0];
}

// Helper: Get trending metrics
export async function getTrendingMetrics(db, { window = '30d', limit = 50 } = {}) {
  const column = window === '7d' ? 'installs_7d' : 'installs_30d';
  const query = `
    SELECT tm.*, s.name, s.category
    FROM trending_metrics tm
    JOIN skills s ON tm.skill_id = s.id
    ORDER BY tm.${column} DESC
    LIMIT $1
  `;
  const result = await db.query(query, [limit]);
  return result.rows;
}

// Helper: Update trending metrics
export async function updateTrendingMetrics(db, { skill_id, installs_7d, installs_30d, rating_avg, rating_count }) {
  const query = `
    INSERT INTO trending_metrics (skill_id, installs_7d, installs_30d, rating_avg, rating_count, calculated_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    ON CONFLICT (skill_id) DO UPDATE SET
      installs_7d = $2,
      installs_30d = $3,
      rating_avg = $4,
      rating_count = $5,
      calculated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await db.query(query, [skill_id, installs_7d, installs_30d, rating_avg, rating_count]);
  return result.rows[0];
}

// Helper: Log installation
export async function logInstallation(db, { skill_id, version_id, user_id, status = 'success', error_message = null }) {
  const query = `
    INSERT INTO installation_log (skill_id, version_id, user_id, status, error_message)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await db.query(query, [skill_id, version_id, user_id, status, error_message]);
  return result.rows[0];
}

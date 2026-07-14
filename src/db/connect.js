import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/marketplace_dev';

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 200) {
      console.warn(`Slow query (${duration}ms): ${text.substring(0, 80)}`);
    }
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

export async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0];
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function health() {
  try {
    const result = await query('SELECT NOW()');
    return result.rows[0];
  } catch {
    return null;
  }
}

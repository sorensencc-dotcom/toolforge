import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, health } from '../db/connect.js';
import * as schema from '../db/schema.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = { query: (text, params) => pool.query(text, params) };

// Health check
app.get('/health', async (req, res) => {
  const check = await health();
  res.json({ status: check ? 'ok' : 'unhealthy' });
});

// GET /api/v1/skills — List skills (paginated)
app.get('/api/v1/skills', async (req, res) => {
  try {
    const { category, status = 'published', limit = 50, offset = 0, sort = 'created_at' } = req.query;
    const skills = await schema.listSkills(db, {
      category: category || undefined,
      status,
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
      sort,
    });
    res.json({ data: skills });
  } catch (error) {
    console.error('GET /api/v1/skills error:', error.message);
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

// GET /api/v1/skills/search — Search skills
app.get('/api/v1/skills/search', async (req, res) => {
  try {
    const { q, limit = 50, offset = 0 } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    const results = await schema.searchSkills(db, q, {
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
    });
    res.json({ data: results });
  } catch (error) {
    console.error('GET /api/v1/skills/search error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/v1/skills/:id — Get skill detail
app.get('/api/v1/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const skill = await schema.getSkill(db, id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    const ratingAvg = await schema.getRatingAverage(db, id);
    res.json({ data: { ...skill, rating: ratingAvg } });
  } catch (error) {
    console.error('GET /api/v1/skills/:id error:', error.message);
    res.status(500).json({ error: 'Failed to fetch skill' });
  }
});

// GET /api/v1/skills/:id/versions — Get skill versions
app.get('/api/v1/skills/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const skill = await schema.getSkill(db, id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    const versions = await schema.getVersions(db, id);
    res.json({ data: versions });
  } catch (error) {
    console.error('GET /api/v1/skills/:id/versions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// GET /api/v1/skills/trending — Get trending skills
app.get('/api/v1/skills/trending', async (req, res) => {
  try {
    const { window = '30d', limit = 50 } = req.query;
    const trending = await schema.getTrendingMetrics(db, {
      window: window === '7d' ? '7d' : '30d',
      limit: Math.min(parseInt(limit) || 50, 100),
    });
    res.json({ data: trending });
  } catch (error) {
    console.error('GET /api/v1/skills/trending error:', error.message);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Marketplace API listening on port ${PORT}`);
});

// Phase 9 Recommendation Service
// Related-skills: category-based by default, co-install boosted above a data
// threshold, with a sparsity fallback so the section is never near-empty.

import {
  getRelatedSkills,
  getCoInstalledSkills,
  getTopRatedSkills,
  countInstalls,
} from '../db/schema.js';

export class RecommendationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecommendationError';
  }
}

// Above this many successful installs, co-occurrence stops being noise and the
// co-install signal is blended in. Tunable constant, not a schema commitment.
export const COINSTALL_THRESHOLD = 100;
// Below this result count the section is backfilled from global top-rated.
export const SPARSITY_FLOOR = 5;

const CATEGORY_WEIGHT = 0.6;
const COINSTALL_WEIGHT = 0.4;

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Blend category rows and co-install rows into a single ranked list.
 * final = 0.6 * norm(category_score) + 0.4 * norm(coinstall_score)
 * where category_score derives from rating_avg (installs_30d tie-break) and
 * coinstall_score from co_install_count. Each set normalized to [0,1] by max.
 */
function blend(categoryRows, coRows) {
  const catRaws = new Float64Array(categoryRows.length);
  let catMax = 1;
  for (let i = 0; i < categoryRows.length; i++) {
    const raw = toNum(categoryRows[i].rating_avg) || toNum(categoryRows[i].installs_30d);
    catRaws[i] = raw;
    if (raw > catMax) catMax = raw;
  }

  const coRaws = new Float64Array(coRows.length);
  let coMax = 1;
  for (let i = 0; i < coRows.length; i++) {
    const raw = toNum(coRows[i].co_install_count);
    coRaws[i] = raw;
    if (raw > coMax) coMax = raw;
  }

  const merged = new Map();

  for (let i = 0; i < categoryRows.length; i++) {
    merged.set(categoryRows[i].id, { row: categoryRows[i], score: CATEGORY_WEIGHT * (catRaws[i] / catMax) });
  }

  for (let i = 0; i < coRows.length; i++) {
    const add = COINSTALL_WEIGHT * (coRaws[i] / coMax);
    const existing = merged.get(coRows[i].id);
    if (existing) {
      existing.score += add;
    } else {
      merged.set(coRows[i].id, { row: coRows[i], score: add });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .map((e) => e.row);
}

/**
 * Get related skills for a target skill.
 * @param {{query: Function}} db
 * @param {string} skillId
 * @param {{limit?: number}} [opts]
 * @returns {Promise<Array>} ranked related Skill rows
 * @throws {RecommendationError}
 */
export async function getRelated(db, skillId, { limit = 10 } = {}) {
  if (!skillId) {
    throw new RecommendationError('skillId is required');
  }

  try {
    const fetchN = Math.max(limit * 2, 20);
    const categoryRows = await getRelatedSkills(db, skillId, { limit: fetchN });

    let results = categoryRows;

    // Data-driven boost only once co-install data is meaningful.
    const installCount = await countInstalls(db, skillId);
    if (installCount >= COINSTALL_THRESHOLD) {
      const coRows = await getCoInstalledSkills(db, skillId, { limit: fetchN });
      if (coRows.length > 0) {
        results = blend(categoryRows, coRows);
      }
    }

    // Sparsity fallback: backfill from global top-rated published skills.
    if (results.length < SPARSITY_FLOOR) {
      const seen = new Set(results.map((r) => r.id));
      const excludeIds = [skillId, ...results.map((r) => r.id)];
      const top = await getTopRatedSkills(db, { limit: limit + excludeIds.length, excludeIds });
      for (const t of top) {
        if (!seen.has(t.id)) {
          results.push(t);
          seen.add(t.id);
        }
      }
    }

    return results.slice(0, limit);
  } catch (error) {
    if (error instanceof RecommendationError) throw error;
    throw new RecommendationError(`Failed to compute related skills: ${error.message}`);
  }
}

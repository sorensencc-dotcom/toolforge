import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * IcfRetrievalAdapter (v2)
 *
 * Grounding & Context Retrieval Adapter for kb-sync's Knowledge Base (Obsidian Wiki Vault).
 * Supports SQLite FTS5 query retrieval (.kb_cache/knowledge.db), catalog matching (wiki/.catalog.json),
 * and disk-based fallback keyword search, returning standardized `icfResponse` context packets.
 */
export class IcfRetrievalAdapter {
  /**
   * @param {Object} options
   * @param {string} [options.kbSyncRoot] - Absolute path to kb-sync workspace root (default: C:\dev\kb-sync)
   */
  constructor(options = {}) {
    this.kbSyncRoot = resolve(options.kbSyncRoot || 'C:\\dev\\kb-sync');
    this.wikiVaultPath = join(this.kbSyncRoot, 'obsidian', 'vault', 'wiki');
    this.dbPath = join(this.kbSyncRoot, '.kb_cache', 'knowledge.db');
    this.catalogPath = join(this.wikiVaultPath, '.catalog.json');
  }

  /**
   * Executes a grounded knowledge query across the kb-sync wiki vault.
   * Priority: 1. SQLite FTS5 cache -> 2. Catalog JSON index -> 3. Markdown disk sweep.
   *
   * @param {Object|string} icfRequest - Query string or request object { query, maxResults }
   * @returns {Object} Standardized `icfResponse` context packet
   */
  queryContextCache(icfRequest) {
    const query = typeof icfRequest === 'string' ? icfRequest : (icfRequest.query || '');
    const maxResults = (typeof icfRequest === 'object' && icfRequest.maxResults) ? icfRequest.maxResults : 5;

    if (!query || query.trim().length === 0) {
      return {
        query: '',
        status: 'EMPTY_QUERY',
        sources: [],
        contextPacket: ''
      };
    }

    const cleanQuery = query.trim();

    // Strategy 1: SQLite FTS5 Search
    if (existsSync(this.dbPath)) {
      try {
        let Database;
        try {
          Database = require('better-sqlite3');
        } catch {
          try {
            Database = require('sqlite3').Database;
          } catch {
            Database = null;
          }
        }

        if (Database && typeof Database === 'function') {
          const db = new Database(this.dbPath, { readonly: true });
          const rows = db.prepare(`
            SELECT doc_id, topic, title, path, snippet(kb_fts, -1, '<b>', '</b>', '...', 15) as snippet
            FROM kb_fts
            WHERE kb_fts MATCH ?
            LIMIT ?
          `).all(cleanQuery, maxResults);
          db.close();

          if (rows && rows.length > 0) {
            const sources = rows.map(r => ({
              topic: r.topic || r.title,
              path: r.path,
              score: 1.0,
              snippet: r.snippet
            }));

            return {
              query: cleanQuery,
              status: 'OK',
              engine: 'sqlite_fts5',
              sources,
              contextPacket: sources.map(s => `## ${s.topic}\nPath: ${s.path}\n\n${s.snippet}`).join('\n\n---\n\n')
            };
          }
        }
      } catch (err) {
        // Fall through to Strategy 2 if SQLite query fails
      }
    }

    // Strategy 2: Catalog Index Search (wiki/.catalog.json)
    if (existsSync(this.catalogPath)) {
      try {
        const rawCatalog = readFileSync(this.catalogPath, 'utf8');
        const catalog = JSON.parse(rawCatalog);
        const queryTerms = cleanQuery.toLowerCase().split(/\s+/);

        const matchedEntries = [];
        const entries = Array.isArray(catalog) ? catalog : (catalog.entries || catalog.notes || []);

        for (const item of entries) {
          const title = (item.title || item.topic || '').toLowerCase();
          const tags = (item.tags || []).map(t => t.toLowerCase()).join(' ');
          const score = queryTerms.reduce((acc, term) => {
            if (title.includes(term)) return acc + 3;
            if (tags.includes(term)) return acc + 1;
            return acc;
          }, 0);

          if (score > 0) {
            matchedEntries.push({
              topic: item.title || item.topic,
              path: item.path || item.file,
              score,
              snippet: item.summary || item.description || `Topic note for ${item.title || item.topic}`
            });
          }
        }

        matchedEntries.sort((a, b) => b.score - a.score);
        const topSources = matchedEntries.slice(0, maxResults);

        if (topSources.length > 0) {
          return {
            query: cleanQuery,
            status: 'OK',
            engine: 'catalog_json',
            sources: topSources,
            contextPacket: topSources.map(s => `## ${s.topic}\nPath: ${s.path}\n\n${s.snippet}`).join('\n\n---\n\n')
          };
        }
      } catch (err) {
        // Fall through to Strategy 3
      }
    }

    // Strategy 3: Disk Keyword Scan over Markdown Files in Vault
    if (existsSync(this.wikiVaultPath)) {
      try {
        const files = this._getMarkdownFiles(this.wikiVaultPath);
        const queryTerms = cleanQuery.toLowerCase().split(/\s+/);
        const matches = [];

        for (const filePath of files) {
          const content = readFileSync(filePath, 'utf8');
          const lowerContent = content.toLowerCase();
          const matchCount = queryTerms.reduce((acc, term) => {
            const regex = new RegExp(term, 'g');
            const m = lowerContent.match(regex);
            return acc + (m ? m.length : 0);
          }, 0);

          if (matchCount > 0) {
            const relPath = relative(this.kbSyncRoot, filePath);
            const filename = filePath.split(/[\\/]/).pop().replace(/\.md$/, '');
            
            // Extract a snippet around the first matching term
            const firstIdx = lowerContent.indexOf(queryTerms[0]);
            const start = Math.max(0, firstIdx - 60);
            const end = Math.min(content.length, firstIdx + 120);
            const snippet = content.substring(start, end).replace(/\s+/g, ' ') + '...';

            matches.push({
              topic: filename,
              path: relPath,
              score: matchCount,
              snippet
            });
          }
        }

        matches.sort((a, b) => b.score - a.score);
        const topSources = matches.slice(0, maxResults);

        if (topSources.length > 0) {
          return {
            query: cleanQuery,
            status: 'OK',
            engine: 'markdown_disk_scan',
            sources: topSources,
            contextPacket: topSources.map(s => `## ${s.topic}\nPath: ${s.path}\n\n${s.snippet}`).join('\n\n---\n\n')
          };
        }
      } catch (err) {
        // Return empty if scan fails
      }
    }

    return {
      query: cleanQuery,
      status: 'NOT_FOUND',
      sources: [],
      contextPacket: ''
    };
  }

  /**
   * Helper to recursively discover .md files under a directory.
   */
  _getMarkdownFiles(dir) {
    let results = [];
    if (!existsSync(dir)) return results;
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this._getMarkdownFiles(fullPath));
      } else if (file.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Operational health probe for git drift & locks.
   */
  validateSyncState() {
    const mergeLockPath = join(this.kbSyncRoot, '.serial-merge.lock');
    const recoveryManifestPath = join(this.kbSyncRoot, '.recovery-manifest.json');
    const stagingDir = join(this.kbSyncRoot, '_kb-sync-staging');

    return {
      state: existsSync(mergeLockPath) ? 'MERGE_LOCKED' : (existsSync(recoveryManifestPath) ? 'RECOVERY_NEEDED' : 'HEALTHY'),
      kbSyncRoot: this.kbSyncRoot,
      isMergeLocked: existsSync(mergeLockPath),
      hasRecoveryManifest: existsSync(recoveryManifestPath),
      isStagingPresent: existsSync(stagingDir)
    };
  }
}

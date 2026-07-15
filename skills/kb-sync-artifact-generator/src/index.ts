#!/usr/bin/env node

/**
 * KB Sync Artifact Generator — Phase 1
 * Features: Impact scoring, actionable recommendations, category filtering
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process'; // noqa: SEC-AUDITOR

const KB_BASE_DIR = process.env.KB_BASE_DIR || 'C:\\dev\\cic-os\\personal-knowledge-base';
const INTEGRATION_DIR = path.join(KB_BASE_DIR, '_integration');
const SYNC_REPORT = path.join(INTEGRATION_DIR, 'sync-report.json');
const INTEGRATION_REPORT = path.join(INTEGRATION_DIR, 'report.json');
const OUTPUT_HTML = path.join(INTEGRATION_DIR, 'kb-sync-interactive-report.html');

interface BrokenLink {
  source: string;
  target: string;
  type: string;
  referenceCount?: number;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SyncReport {
  summary: {
    total_pages: number;
    broken_links: number;
    case_normalizations: number;
    status: string;
  };
  broken_links: BrokenLink[];
  recommendations: Array<{ priority: string; action: string; details: string }>;
}

interface IntegrationReport {
  summary: {
    total_pages: number;
    wiki_pages: number;
    docs_pages: number;
    cross_references: number;
    duplicate_groups: number;
  };
  duplicates: Array<{ path1: string; path2: string; similarity_score: number }>;
}

interface RecommendationItem {
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  command: string;
  affectedCount: number;
}

function runSync(): void {
  if (fs.existsSync(SYNC_REPORT) && fs.existsSync(INTEGRATION_REPORT)) {
    console.log('[INFO] Reports already exist, skipping sync');
    return;
  }

  console.log('[INFO] Running sync-all.py...');
  try {
    const result = execSync(`cd "${KB_BASE_DIR}" && python3 sync-all.py 2>&1`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    console.log(result);
  } catch (error: any) {
    console.error('[ERROR] Sync failed:', error.message);
    throw error;
  }
}

function parseSyncReport(): SyncReport | null {
  if (!fs.existsSync(SYNC_REPORT)) {
    console.warn('[WARN] Sync report not found:', SYNC_REPORT);
    return null;
  }
  return JSON.parse(fs.readFileSync(SYNC_REPORT, 'utf-8'));
}

function parseIntegrationReport(): IntegrationReport | null {
  if (!fs.existsSync(INTEGRATION_REPORT)) {
    console.warn('[WARN] Integration report not found:', INTEGRATION_REPORT);
    return null;
  }
  return JSON.parse(fs.readFileSync(INTEGRATION_REPORT, 'utf-8'));
}

function categorizeBrokenLinks(links: BrokenLink[]): Record<string, BrokenLink[]> {
  const categories: Record<string, BrokenLink[]> = {
    'Missing Roadmap': [],
    'Missing Operations': [],
    'Missing Architecture': [],
    'External Reference': [],
    'Template Variable': [],
    'Other': [],
  };

  const targetCounts = new Map<string, number>();
  for (const link of links) {
    targetCounts.set(link.target, (targetCounts.get(link.target) || 0) + 1);
  }

  for (const link of links) {
    const refCount = targetCounts.get(link.target) || 1;
    const severity = refCount >= 5 ? 'HIGH' : refCount >= 2 ? 'MEDIUM' : 'LOW';

    link.referenceCount = refCount;
    link.severity = severity;

    if (link.target.includes('roadmap')) {
      categories['Missing Roadmap'].push(link);
    } else if (link.target.includes('operation') || link.target.includes('running') || link.target.includes('monitoring') || link.target.includes('sealing')) {
      categories['Missing Operations'].push(link);
    } else if (link.target.includes('architecture') || link.target.includes('overview') || link.target.includes('routing') || link.target.includes('drift')) {
      categories['Missing Architecture'].push(link);
    } else if (link.target.startsWith('../../') || (link.target.startsWith('../') && (link.target.includes('.ts') || link.target.includes('.json') || link.target.includes('.js')))) {
      categories['External Reference'].push(link);
    } else if (link.target.includes('$') || link.target.includes('template') || link.target.includes('...')) {
      categories['Template Variable'].push(link);
    } else {
      categories['Other'].push(link);
    }
  }

  return categories;
}

function generateRecommendations(categories: Record<string, BrokenLink[]>): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  const roadmapLinks = categories['Missing Roadmap'] || [];
  if (roadmapLinks.length > 0) {
    const uniqueTargets = new Set(roadmapLinks.map(l => l.target));
    recommendations.push({
      category: 'Missing Roadmaps',
      priority: 'HIGH',
      description: 'Create missing roadmap files (' + uniqueTargets.size + ' unique, ' + roadmapLinks.length + ' references)',
      command: 'mkdir -p docs/roadmaps && touch docs/roadmaps/unified-roadmap.md docs/roadmaps/cic-roadmap.md',
      affectedCount: roadmapLinks.length,
    });
  }

  const opsLinks = categories['Missing Operations'] || [];
  if (opsLinks.length > 0) {
    recommendations.push({
      category: 'Missing Operations Guides',
      priority: 'HIGH',
      description: 'Create operations documentation (' + opsLinks.length + ' references)',
      command: 'mkdir -p docs/operations && touch docs/operations/{monitoring,running,sealing}.md',
      affectedCount: opsLinks.length,
    });
  }

  const archLinks = categories['Missing Architecture'] || [];
  if (archLinks.length > 0) {
    recommendations.push({
      category: 'Missing Architecture Docs',
      priority: 'MEDIUM',
      description: 'Consolidate architecture docs (' + archLinks.length + ' references)',
      command: 'mkdir -p docs/architecture && touch docs/architecture/{overview,routing,drift}.md',
      affectedCount: archLinks.length,
    });
  }

  const externalLinks = categories['External Reference'] || [];
  if (externalLinks.length > 0) {
    recommendations.push({
      category: 'External References',
      priority: 'MEDIUM',
      description: 'Review source code references (' + externalLinks.length + ' references)',
      command: 'grep -r "../../src" docs/ | grep -v node_modules | head -10',
      affectedCount: externalLinks.length,
    });
  }

  const templateLinks = categories['Template Variable'] || [];
  if (templateLinks.length > 0) {
    recommendations.push({
      category: 'Template Variables',
      priority: 'LOW',
      description: 'Resolve template variables (' + templateLinks.length + ' references)',
      command: 'grep -r "template" docs/ --include="*.md" | head -10',
      affectedCount: templateLinks.length,
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function generateHTMLArtifact(syncReport: SyncReport | null, integrationReport: IntegrationReport | null): string {
  const brokenLinks = syncReport?.broken_links || [];
  const categories = categorizeBrokenLinks(brokenLinks);
  const recommendations = generateRecommendations(categories);

  const categoryChart = Object.entries(categories)
    .filter(([_, links]) => links.length > 0)
    .map(([cat, links]) => ({ category: cat, count: links.length }));

  const brokenLinksJSON = JSON.stringify(brokenLinks.sort((a, b) => (b.referenceCount || 1) - (a.referenceCount || 1)));
  const categoriesJSON = JSON.stringify(categories);
  const chartDataJSON = JSON.stringify(categoryChart);
  const recommendationsJSON = JSON.stringify(recommendations);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KB Sync Interactive Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js" integrity="sha384-iU8HYtnGQ8Cy4zl7gbNMOhsDTTKX02BTXptVP/vqAWIaTfM7isw76iyZCsjL2eVi" crossorigin="anonymous"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/gridjs@5.0.2/dist/gridjs.umd.js" integrity="sha384-/XXDzxe4FsGiAe50i/u9pY/Vy/uX654MHB1xoc1BJNnH1WXHhqHga9g3q5tF4gj7" crossorigin="anonymous"><\/script>
    <link href="https://cdn.jsdelivr.net/npm/gridjs@5.0.2/dist/theme/mermaid.min.css" rel="stylesheet">
    <style>
        :root {
            color-scheme: light;
            --color-charcoal: #2C2C2C;
            --color-offwhite: #F5F3EF;
            --color-ember: #8B4513;
            --color-rust: #A0522D;
            --color-brass: #D4AF37;
            --color-sage: #9B9B8F;
            --color-high: #E63946;
            --color-medium: #F77F00;
            --color-low: #06A77D;
        }

        [data-theme="dark"] {
            --bg-primary: #1A1A1A;
            --bg-secondary: #242424;
            --text-primary: #F5F3EF;
            --text-secondary: #9B9B8F;
            --accent: #D4AF37;
            --border: rgba(212, 175, 55, 0.2);
        }

        [data-theme="light"] {
            --bg-primary: #FAFAF8;
            --bg-secondary: #F5F3EF;
            --text-primary: #2C2C2C;
            --text-secondary: #9B9B8F;
            --accent: #8B4513;
            --border: rgba(139, 69, 19, 0.15);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Baskerville', 'Garamond', serif;
            line-height: 1.65;
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
            transition: background-color 0.3s, color 0.3s;
        }

        h1 {
            font-family: 'Georgia', serif;
            font-size: 2.5rem;
            font-weight: 400;
            margin-bottom: 0.5rem;
        }

        h2 {
            font-family: 'Georgia', serif;
            font-size: 1.8rem;
            font-weight: 400;
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: var(--accent);
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.75rem;
        }

        .meta {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-bottom: 2rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }

        .stat-card {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            padding: 1.5rem;
            text-align: center;
            border-radius: 3px;
        }

        .stat-value {
            font-family: 'Georgia', serif;
            font-size: 2.2rem;
            font-weight: 400;
            color: var(--accent);
            margin-bottom: 0.5rem;
        }

        .stat-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .status {
            display: inline-block;
            padding: 0.6rem 1.2rem;
            background-color: rgba(160, 82, 45, 0.15);
            color: #A0522D;
            border: 1px solid #A0522D;
            border-radius: 3px;
            font-size: 0.75rem;
            text-transform: uppercase;
            margin: 1rem 0;
        }

        .chart-container {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            padding: 1.5rem;
            border-radius: 3px;
            margin: 2rem 0;
            height: 400px;
            position: relative;
            cursor: pointer;
        }

        .chart-container canvas {
            position: relative;
            height: 100%;
            width: 100%;
        }

        .filter-info {
            font-size: 0.85rem;
            color: var(--accent);
            margin: 0.5rem 0 1rem 0;
            font-style: italic;
        }

        .recommendations-panel {
            background-color: var(--bg-secondary);
            border-left: 3px solid var(--accent);
            padding: 1.5rem;
            margin: 2rem 0;
            border-radius: 3px;
        }

        .recommendation-item {
            background-color: var(--bg-primary);
            border-left: 3px solid;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 3px;
        }

        .recommendation-item.HIGH {
            border-left-color: var(--color-high);
            background-color: rgba(230, 57, 70, 0.08);
        }

        .recommendation-item.MEDIUM {
            border-left-color: var(--color-medium);
            background-color: rgba(247, 127, 0, 0.08);
        }

        .recommendation-item.LOW {
            border-left-color: var(--color-low);
            background-color: rgba(6, 168, 125, 0.08);
        }

        .rec-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .rec-priority {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 2px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: white;
        }

        .rec-priority.HIGH {
            background-color: var(--color-high);
        }

        .rec-priority.MEDIUM {
            background-color: var(--color-medium);
        }

        .rec-priority.LOW {
            background-color: var(--color-low);
        }

        .rec-count {
            font-size: 0.8rem;
            color: var(--text-secondary);
        }

        .rec-description {
            margin-bottom: 0.75rem;
            line-height: 1.5;
        }

        .rec-command {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            padding: 0.75rem;
            border-radius: 2px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.85rem;
            overflow-x: auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
        }

        .rec-command code {
            flex: 1;
            color: var(--accent);
        }

        .copy-btn {
            background-color: var(--accent);
            color: var(--bg-primary);
            border: none;
            padding: 0.4rem 0.8rem;
            border-radius: 2px;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .copy-btn:hover {
            opacity: 0.8;
        }

        .table-container {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            padding: 1.5rem;
            border-radius: 3px;
            margin: 2rem 0;
            overflow-x: auto;
        }

        .search-box {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            padding: 1rem;
            border-radius: 3px;
            margin: 1.5rem 0;
        }

        .search-box input {
            width: 100%;
            padding: 0.75rem;
            background-color: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 3px;
            color: var(--text-primary);
            font-family: 'Baskerville', serif;
            font-size: 1rem;
        }

        .severity-HIGH {
            color: var(--color-high);
            font-weight: 600;
        }

        .severity-MEDIUM {
            color: var(--color-medium);
            font-weight: 600;
        }

        .severity-LOW {
            color: var(--color-low);
            font-weight: 600;
        }

        .gridjs-table {
            background-color: var(--bg-primary) !important;
            color: var(--text-primary) !important;
        }

        .gridjs-th, .gridjs-td {
            color: var(--text-primary) !important;
            border-color: var(--border) !important;
        }

        .gridjs-tr:hover {
            background-color: var(--bg-secondary) !important;
        }

        .theme-toggle {
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            background-color: var(--bg-secondary);
            border: 1px solid var(--border);
            padding: 0.6rem 1rem;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.75rem;
            color: var(--text-primary);
            text-transform: uppercase;
            font-weight: 600;
            z-index: 1000;
        }

        @media (max-width: 600px) {
            body {
                padding: 1rem;
            }
            h1 {
                font-size: 2rem;
            }
            .summary-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body data-theme="dark">
    <button class="theme-toggle" onclick="toggleTheme()">Light</button>

    <h1>KB Sync - Interactive Report</h1>
    <div class="meta">Generated: ${new Date().toISOString()} | Phase 1: Impact Scoring + Recommendations + Filtering</div>

    <div class="summary-grid">
        <div class="stat-card">
            <div class="stat-value">${syncReport?.summary.total_pages || 0}</div>
            <div class="stat-label">Pages Scanned</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${syncReport?.summary.broken_links || 0}</div>
            <div class="stat-label">Broken Links</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${integrationReport?.summary.total_pages || 0}</div>
            <div class="stat-label">Total KB Pages</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${integrationReport?.summary.duplicate_groups || 0}</div>
            <div class="stat-label">Duplicate Groups</div>
        </div>
    </div>

    <div class="status">Issues Found: ${syncReport?.summary.broken_links || 0} Broken Links</div>

    <h2>Issues by Category (Click to Filter)</h2>
    <div class="filter-info" id="filterInfo"><\/div>
    <div class="chart-container">
        <canvas id="categoryChart"><\/canvas>
    </div>

    <h2>Actionable Recommendations</h2>
    <div class="recommendations-panel">
        <div id="recommendations"><\/div>
    </div>

    <h2>Search Broken Links</h2>
    <div class="search-box">
        <input type="text" id="searchBox" placeholder="Search by file, target, or category..." onkeyup="filterTable()">
    </div>

    <h2>Broken Links Table (Sorted by Impact)</h2>
    <div class="table-container">
        <div id="table"><\/div>
    </div>

    <script>
        const brokenLinks = ${brokenLinksJSON};
        const categories = ${categoriesJSON};
        const chartData = ${chartDataJSON};
        const recommendations = ${recommendationsJSON};

        let activeFilter = null;
        let chartInstance = null;

        function toggleTheme() {
            const html = document.documentElement;
            const theme = html.getAttribute('data-theme');
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            document.querySelector('.theme-toggle').textContent = newTheme === 'dark' ? 'Light' : 'Dark';
            localStorage.setItem('kb-sync-theme', newTheme);
        }

        const savedTheme = localStorage.getItem('kb-sync-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.querySelector('.theme-toggle').textContent = savedTheme === 'dark' ? 'Light' : 'Dark';

        const recsHTML = recommendations.map(rec => \`
            <div class="recommendation-item \${rec.priority}">
                <div class="rec-header">
                    <div>
                        <strong>\${rec.category}</strong>
                        <span class="rec-priority \${rec.priority}">\${rec.priority}</span>
                    </div>
                    <span class="rec-count">\${rec.affectedCount} references</span>
                </div>
                <div class="rec-description">\${rec.description}</div>
                <div class="rec-command">
                    <code>\${rec.command}</code>
                    <button class="copy-btn" onclick="copyToClipboard('\${rec.command}')">Copy</button>
                </div>
            </div>
        \`).join('');
        document.getElementById('recommendations').innerHTML = recsHTML;

        const ctx = document.getElementById('categoryChart').getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.category),
                datasets: [{
                    label: 'Broken Links',
                    data: chartData.map(d => d.count),
                    backgroundColor: chartData.map(d => d.count >= 30 ? '#E63946' : d.count >= 15 ? '#F77F00' : '#06A77D'),
                    borderColor: 'rgba(212, 175, 55, 1)',
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: () => 'Click to filter table'
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const category = chartData[index].category;
                        activeFilter = activeFilter === category ? null : category;
                        updateFilterDisplay();
                        refreshTable();
                    }
                },
            },
        });

        let gridTable = null;
        function refreshTable() {
            const filteredLinks = activeFilter
                ? brokenLinks.filter(l => getCategoryForLink(l.target) === activeFilter)
                : brokenLinks;

            const tableData = filteredLinks.map(link => [
                link.source,
                link.target,
                getCategoryForLink(link.target),
                \`<span class="severity-\${link.severity}">\${link.severity}</span>\`,
                link.referenceCount || 1,
            ]);

            if (gridTable) {
                gridTable.destroy();
            }

            gridTable = new gridjs.Grid({
                columns: ['Source File', 'Target', 'Category', 'Severity', 'References'],
                data: tableData,
                pagination: { limit: 15 },
                search: true,
                sort: true,
            });
            gridTable.render(document.getElementById('table'));
        }

        function updateFilterDisplay() {
            const info = document.getElementById('filterInfo');
            if (activeFilter) {
                const count = brokenLinks.filter(l => getCategoryForLink(l.target) === activeFilter).length;
                info.innerHTML = \`<strong>Filtered:</strong> \${activeFilter} (\${count} items) - <a href="javascript:clearFilter()" style="cursor:pointer;color:var(--accent)">Clear filter</a>\`;
            } else {
                info.innerHTML = '';
            }
        }

        function clearFilter() {
            activeFilter = null;
            updateFilterDisplay();
            refreshTable();
        }

        function getCategoryForLink(target) {
            if (target.includes('roadmap')) return 'Missing Roadmap';
            if (target.includes('operation') || target.includes('running') || target.includes('monitoring')) return 'Missing Operations';
            if (target.includes('architecture') || target.includes('overview') || target.includes('routing')) return 'Missing Architecture';
            if (target.startsWith('../../') || (target.startsWith('../') && (target.includes('.ts') || target.includes('.json')))) return 'External Reference';
            if (target.includes('template')) return 'Template Variable';
            return 'Other';
        }

        function filterTable() {
            // Grid.js handles search natively
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard!');
            });
        }

        // Initial render
        refreshTable();
    <\/script>
</body>
</html>`;

  return html;
}

function main(): void {
  try {
    console.log('[INFO] KB Sync Artifact Generator started');

    runSync();

    const syncReport = parseSyncReport();
    const integrationReport = parseIntegrationReport();

    if (!syncReport) {
      console.error('[ERROR] Could not parse sync report');
      process.exit(1);
    }

    console.log('[INFO] Sync: ' + syncReport.summary.broken_links + ' broken links');
    console.log('[INFO] Integration: ' + (integrationReport?.summary.total_pages || 0) + ' total pages');

    const html = generateHTMLArtifact(syncReport, integrationReport);
    fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');
    console.log('[INFO] Artifact saved to ' + OUTPUT_HTML);

    console.log('\n=== PHASE 1 COMPLETE ===');
    console.log('OK: Impact Scoring - Color-coded by reference count');
    console.log('OK: Recommendations - Multiple fix categories');
    console.log('OK: Category Filtering - Click chart bars to filter table');

  } catch (error) {
    console.error('[ERROR]', error);
    process.exit(1);
  }
}

main();

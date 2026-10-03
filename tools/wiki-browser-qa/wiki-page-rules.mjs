export const ROOT_WIKI_FILES = [
  'GOVERNANCE.md',
  'INDEX.md',
  'QUICKSTART.md',
  'CHECKLIST.md',
  'TOOL_CREATION_GUIDE.md',
  'OLLAMA_DEPLOYMENT_GUIDE.md',
  'OLLAMA_PROVIDER_SETUP.md',
  'OPERATOR-COMMANDS.md',
  'OPERATOR_GUIDE.md',
  'PRODUCTION_PREREQUISITES.md',
  'trm-research-gaps.md',
];

export const ROOT_WIKI_PAGE_MAPPINGS = [
  { src: 'docs/wiki-pages/toolforge-architecture-overview.html', dest: 'toolforge-architecture-overview.html' },
  { src: 'docs/wiki-pages/toolforge-architecture-overview.png', dest: 'toolforge-architecture-overview.png' },
  { src: 'docs/ROLLBACK_RUNBOOK.md', dest: 'ROLLBACK_RUNBOOK.md' },
  { src: 'docs/KB_SYNC_DAG.md', dest: 'KB_SYNC_DAG.md' },
  { src: 'docs/DOCS_INDEX.md', dest: 'DOCS_INDEX.md' },
  { src: 'kb-sync/README.md', dest: 'kb-sync-readme.md' },
  { src: 'trm-gap-triage-architecture.png', dest: 'trm-gap-triage-architecture.png' },
  { src: 'trm-gap-triage-architecture.png', dest: 'kb-sync/trm-gap-triage-architecture.png' },
  { src: 'trm-gap-triage-architecture.html', dest: 'trm-gap-triage-architecture.html' },
];

const visibleNonOverflowing = {
  desktop: { requireVisible: true, allowHorizontalOverflow: false },
  mobile: { requireVisible: true, allowHorizontalOverflow: false },
};

export const CLASSIFIED_WIKI_PAGES = [
  {
    slug: 'toolforge-architecture-overview',
    categories: ['architecture', 'provider', 'governance', 'lifecycle'],
    sourcePage: 'docs/wiki-pages/toolforge-architecture-overview.html',
    requiredDiagrams: [{
      selector: '.diagram-container > svg',
      assetPattern: '(?:^|/)toolforge-architecture-overview\\.html$',
      githubSelector: 'img[src$="toolforge-architecture-overview.png"]',
      githubAssetPattern: '(?:^|/)toolforge-architecture-overview\\.png$',
      sourceAsset: 'docs/wiki-pages/toolforge-architecture-overview.html',
      publishedAssetPath: 'toolforge-architecture-overview.html',
      requireAlt: true,
      requireCaption: true,
      viewports: visibleNonOverflowing,
    }],
  },
  {
    slug: 'GOVERNANCE',
    categories: ['governance', 'lifecycle'],
    sourcePage: 'GOVERNANCE.md',
    requiredDiagrams: [{
      selector: 'img[src$="toolforge-architecture-overview.png"]',
      assetPattern: '(?:^|/)toolforge-architecture-overview\\.png$',
      sourceAsset: 'docs/wiki-pages/toolforge-architecture-overview.png',
      publishedAssetPath: 'docs/wiki-pages/toolforge-architecture-overview.png',
      requireAlt: true,
      requireCaption: true,
      viewports: visibleNonOverflowing,
    }],
  },
];

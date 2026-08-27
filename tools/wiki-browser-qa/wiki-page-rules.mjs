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
  { src: 'wiki/toolforge-architecture-overview.html', dest: 'toolforge-architecture-overview.html' },
  { src: 'wiki/toolforge-architecture-overview.png', dest: 'toolforge-architecture-overview.png' },
  { src: 'wiki/research/whichllm-model-selection-evaluator.md', dest: 'whichllm-model-selection-evaluator.md' },
  { src: 'wiki/research/whichllm-architecture-topology.png', dest: 'whichllm-architecture-topology.png' },
  { src: 'wiki/research/whichllm-architecture-topology.html', dest: 'whichllm-architecture-topology.html' },
  { src: 'wiki/research/competitor-watchlist-drift-engine.md', dest: 'competitor-watchlist-drift-engine.md' },
  { src: 'wiki/research/historical-revocation-verification.md', dest: 'historical-revocation-verification.md' },
  { src: 'wiki/research/mobile-websocket-heartbeats.md', dest: 'mobile-websocket-heartbeats.md' },
  { src: 'docs/ROLLBACK_RUNBOOK.md', dest: 'ROLLBACK_RUNBOOK.md' },
  { src: 'docs/KB_SYNC_DAG.md', dest: 'KB_SYNC_DAG.md' },
  { src: 'docs/DOCS_INDEX.md', dest: 'DOCS_INDEX.md' },
  { src: 'kb-sync/README.md', dest: 'kb-sync-readme.md' },
  { src: 'wiki/Log.md', dest: 'Log.md' },
];

const visibleNonOverflowing = {
  desktop: { requireVisible: true, allowHorizontalOverflow: false },
  mobile: { requireVisible: true, allowHorizontalOverflow: false },
};

export const CLASSIFIED_WIKI_PAGES = [
  {
    slug: 'toolforge-architecture-overview',
    categories: ['architecture', 'provider', 'governance', 'lifecycle'],
    sourcePage: 'wiki/toolforge-architecture-overview.html',
    requiredDiagrams: [{
      selector: '.diagram-container > svg',
      assetPattern: '(?:^|/)toolforge-architecture-overview\\.html$',
      githubSelector: 'img[src$="toolforge-architecture-overview.png"]',
      githubAssetPattern: '(?:^|/)toolforge-architecture-overview\\.png$',
      sourceAsset: 'wiki/toolforge-architecture-overview.html',
      publishedAssetPath: 'toolforge-architecture-overview.html',
      requireAlt: true,
      requireCaption: true,
      viewports: visibleNonOverflowing,
    }],
  },
  {
    slug: 'OLLAMA_PROVIDER_SETUP',
    categories: ['provider'],
    sourcePage: 'OLLAMA_PROVIDER_SETUP.md',
    requiredDiagrams: [{
      selector: 'img[src$="/wiki/research/whichllm-architecture-topology.png"]',
      assetPattern: '(?:^|/)wiki/research/whichllm-architecture-topology\\.png$',
      sourceAsset: 'wiki/research/whichllm-architecture-topology.png',
      publishedAssetPath: 'wiki/research/whichllm-architecture-topology.png',
      requireAlt: true,
      requireCaption: true,
      viewports: visibleNonOverflowing,
    }],
  },
  {
    slug: 'OLLAMA_DEPLOYMENT_GUIDE',
    categories: ['provider', 'lifecycle'],
    sourcePage: 'OLLAMA_DEPLOYMENT_GUIDE.md',
    requiredDiagrams: [{
      selector: 'img[src$="/wiki/research/whichllm-architecture-topology.png"]',
      assetPattern: '(?:^|/)wiki/research/whichllm-architecture-topology\\.png$',
      sourceAsset: 'wiki/research/whichllm-architecture-topology.png',
      publishedAssetPath: 'wiki/research/whichllm-architecture-topology.png',
      requireAlt: true,
      requireCaption: true,
      viewports: visibleNonOverflowing,
    }],
  },
  {
    slug: 'whichllm-model-selection-evaluator',
    categories: ['WhichLLM', 'model-selection', 'provider', 'architecture'],
    sourcePage: 'wiki/research/whichllm-model-selection-evaluator.md',
    requiredDiagrams: [{
      selector: 'img[src$="/whichllm-architecture-topology.png"]',
      assetPattern: '(?:^|/)whichllm-architecture-topology\\.png$',
      sourceAsset: 'wiki/research/whichllm-architecture-topology.png',
      publishedAssetPath: 'whichllm-architecture-topology.png',
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
      selector: 'img[src$="/wiki/toolforge-architecture-overview.png"]',
      assetPattern: '(?:^|/)wiki/toolforge-architecture-overview\\.png$',
      sourceAsset: 'wiki/toolforge-architecture-overview.png',
      publishedAssetPath: 'wiki/toolforge-architecture-overview.png',
      requireAlt: true,
      requireCaption: true,
      viewports: visibleNonOverflowing,
    }],
  },
];

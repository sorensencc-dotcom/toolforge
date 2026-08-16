---
name: phase-26-torquequery
description: Phase 26 — TorqueQuery Ingestion & Search Engine; clean-room open-source backbone; parallel track 2026-06-15 to 2026-06-29
metadata: 
  node_type: memory
  type: project
  originSessionId: 353d5b12-b4f7-4d10-b9ae-c094bbfd11b5
---

**TorqueQuery (Phase 26)** is CIC's **long-term world-ingestion and search backbone**.

## Locked Decisions

### 1. Phase Number & Timeline
- **Phase 26** (not blocking Phases 23–25)
- **Execution:** 2026-06-15 through 2026-06-29 (15 days, **parallel track**)
- Starts after Memory/Governance/Skill Graph lock in; enables Phase 27+ (APR, CRO, CKG)

### 2. Scope: Parallel, Not Blocking
- TorqueQuery runs **independently**
- Does not delay Memory (Phase 23), Governance (Phase 24), Skill Graph (Phase 25)
- First infrastructure that Phase 27 (APR) can use for world search context
- Foundational for Rewrite Labs corpus building + SMB site capture

### 3. Repository Visibility: Public from Day One
- **Open-source** (MIT license)
- Clean-room: no AGPL contamination, no CIC/Rewrite Labs internals
- CIC & Rewrite Labs integrate via **thin adapters** in `packages/adapters/{cic,rewritelabs}/`
- Enables future community contributions and standalone adoption

## Architecture Overview

**Eight core subsystems:**
1. Crawler — domain crawling, sitemap parsing, robots.txt compliance
2. Scraper — Playwright JS rendering, anti-bot, screenshots
3. Mapper — URL graph, section classification, crawl planning
4. Parser — HTML/PDF/DOCX → Markdown + structured JSON
5. Proxy Layer — rotation, geo-targeting, stealth headers
6. Indexer — chunking, embeddings, pluggable backends (pgvector, Qdrant, Weaviate)
7. Search Engine — hybrid (vector + BM25), filtering, reranking
8. Actor Runtime — crawl jobs, batch scrape, periodic refresh

**API Surface:**
- HTTP: `/crawl`, `/scrape`, `/batch/scrape`, `/parse`, `/index`, `/search`
- GRPC: `TorqueCrawlerService`, `TorqueSearchService`, `TorqueIndexService`

## Integration Model

**CIC** uses TorqueQuery via HTTP/GRPC:
- Adapter: `packages/adapters/cic/cic_client.ts`
- Enables CIC agents to search world knowledge deterministically
- CIC remains private; no TorqueQuery knowledge of CIC internals

**Rewrite Labs** uses TorqueQuery via HTTP/GRPC:
- Adapter: `packages/adapters/rewritelabs/rewritelabs_ingest.ts`
- Corpus building, site capture, SMB benchmark ingestion
- Rewrite Labs remains private; no TorqueQuery knowledge of RL internals

## Deliverables (8 parts)

| Part | Deliverable | Timeline |
|------|-------------|----------|
| 26.1 | Architecture Spec | 2 days |
| 26.2 | API & Integration Specs | 1 day |
| 26.3–26.5 | Core Implementation (8 subsystems) | 6 days |
| 26.6 | Actor Runtime & APIs | 3 days |
| 26.7 | CIC & Rewrite Labs Adapters | 2 days |
| 26.8 | Infra, Examples, Docs | 2 days |

**Total: 15 days** (parallel execution where possible)

## Key Success Criteria

✅ All 8 subsystems implemented with test coverage  
✅ HTTP API handles full crawl → parse → index → search pipeline  
✅ GRPC services callable and performant  
✅ Parser achieves 95%+ markdown extraction fidelity  
✅ Search returns results in <500ms over 100K+ docs  
✅ CIC & Rewrite Labs adapters work end-to-end  
✅ Example projects run without manual intervention  
✅ Documentation ready for open-source adoption  

## Why This Phase

TorqueQuery is **foundational** because:
- CIC needs deterministic world ingestion (crawl/scrape/parse/index)
- Rewrite Labs needs SMB site capture for benchmark corpus
- Both need hybrid search (vector + keyword)
- Must be public (clean-room, no AGPL) for long-term open-sourcing
- Runs **parallel** to Memory/Governance/Skill Graph — no blocking dependencies

## Integration Points (Phase 27+)

- **Phase 27 (APR)** can use TorqueQuery search for planning context
- **Phase 28 (CRO)** can delegate scraping/indexing work to TorqueQuery
- **Phase 29 (CKG)** can ingest structured world knowledge from TorqueQuery

## Repository Layout

```
torquequery/
  README.md
  LICENSE (MIT)
  docs/
    architecture.md
    api.md
    cic-integration.md
    rewritelabs-integration.md

  packages/
    core/ (8 subsystems)
    api/ (HTTP + GRPC)
    adapters/cic/
    adapters/rewritelabs/

  infra/ (Docker, K8s)
  examples/ (basic crawl, CIC search, RL ingest)
```

## Related Memories

[[master-roadmap-location]] — CIC_MASTER_ROADMAP.md is the single source of truth; Phase 26 now locked in.

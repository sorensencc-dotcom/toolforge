import fs from 'node:fs';
import path from 'node:path';

/**
 * generateMentalModels
 * 
 * Compiles pre-computed standing mental models into `wiki/mental-models/`
 * based on core system topologies, research matrices, and cognitive graphs.
 *
 * @param {string} repoRoot - Path to the repository root
 * @param {Object} [options] - Optional configurations
 * @returns {Array<{file: string, title: string, sizeBytes: number}>} List of generated mental models
 */
export function generateMentalModels(repoRoot = '.', options = {}) {
  const root = path.resolve(repoRoot);
  const mentalModelsDir = path.join(root, 'wiki', 'mental-models');
  fs.mkdirSync(mentalModelsDir, { recursive: true });

  const models = [
    {
      slug: 'trm-closed-loop-topology.md',
      title: 'TRM Closed-Loop Topology',
      category: 'mental-model',
      tags: ['trm', 'closed-loop', 'notebooklm', 'grounding'],
      summary: 'Bi-directional closed-loop research mining and synthesis cycle across NotebookLM and Layer 2 Semantic Wiki.',
      content: `# TRM Closed-Loop Topology

## Core Mental Model
The Topic Research Mining (TRM) loop represents a continuous cycle between **NotebookLM grounded contexts** and the **Layer 2 Semantic Wiki**:

\`\`\`mermaid
flowchart LR
    A["Mined Gaps\n(trm mine-notebooklm)"] --> B["Context Cache &\nQuery Expansion"]
    B --> C["Source Resolver &\nGrounding Gate"]
    C --> D["Layer 2 Wiki &\nMental Models"]
    D --> E["Master Knowledge Pack\n(.nlm_pack)"]
    E --> A
\`\`\`

## Key Invariants
1. **Evidence Before Confidence**: Every synthesized concept node must link back to a verified source hash and span.
2. **Deterministic Normalization**: All incoming source IDs resolve to canonical \`src-*\` format.
3. **Audit Trail**: Every loop iteration appends immutable telemetry records to \`wiki/Log.md\`.
`
    },
    {
      slug: 'whichllm-hardware-aware-routing.md',
      title: 'WhichLLM Hardware-Aware Routing',
      category: 'mental-model',
      tags: ['whichllm', 'routing', 'bfcl', 'benchmark'],
      summary: 'Dynamic model selection combining BFCL function-calling accuracy with local hardware VRAM/compute constraints.',
      content: `# WhichLLM Hardware-Aware Routing

## Core Mental Model
WhichLLM dynamically routes cognitive and synthesis tasks by balancing model capabilities against host execution constraints:

\`\`\`mermaid
flowchart TD
    Task["Incoming Task Shape"] --> Evaluator["WhichLLM Evaluator\n(BFCL Benchmarks)"]
    Evaluator --> HW{"Hardware Profile\n(VRAM / Compute)"}
    HW -->|"High VRAM / GPU"| Local["Local Ollama / Small Model\n(Low Latency, Zero API Cost)"]
    HW -->|"Complex / Multimodal"| Cloud["Frontier API / OpenRouter\n(Deep Synthesis)"]
\`\`\`

## Decision Principles
- Route high-frequency query expansions to sub-millisecond local heuristics or Ollama embeddings.
- Escalate unresolved contradictions or complex multi-document synthesis to grounded frontier models.
`
    },
    {
      slug: 'layer2-semantic-wiki-compaction.md',
      title: 'Layer 2 Semantic Wiki Compaction',
      category: 'mental-model',
      tags: ['wiki', 'karpathy-pattern', 'compaction', 'layer2'],
      summary: 'Deterministic knowledge distillation pattern from raw research payloads into enduring markdown concepts.',
      content: `# Layer 2 Semantic Wiki Compaction

## Core Mental Model
Raw web search results and unstructured transcripts are ephemeral. The Layer 2 Semantic Wiki acts as the curated, human-and-agent readable permanent knowledge repository.

## Synthesis Lifecycle
1. **Ingest & Stage**: Raw JSON payloads written to \`_kb-sync-staging/\`.
2. **Source Resolution**: Resolving content hashes, byte spans, and canonical IDs.
3. **Semantic Distillation**: Extracting atomic concepts with frontmatter into \`wiki/research/\`.
4. **Audit Logging**: Appending to \`wiki/Log.md\` for longitudinal provenance.
`
    }
  ];

  const results = [];

  for (const model of models) {
    const filePath = path.join(mentalModelsDir, model.slug);
    const frontmatter = `---\ntitle: "${model.title}"\ncategory: ${model.category}\ntags: [${model.tags.join(', ')}]\nsummary: "${model.summary}"\nlast_updated: ${new Date().toISOString()}\n---\n\n`;
    const fullContent = frontmatter + model.content;

    fs.writeFileSync(filePath, fullContent, 'utf8');
    const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
    const sizeBytes = Buffer.byteLength(fullContent, 'utf8');

    results.push({
      file: relativePath,
      title: model.title,
      sizeBytes
    });
  }

  return results;
}

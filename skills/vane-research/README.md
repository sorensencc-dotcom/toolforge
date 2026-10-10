# vane-research

Air-gapped web search and cited QA using local Vane (SearXNG + Ollama).

## Quick Start

```javascript
import { VaneResearchSkill } from './src/index.mjs';

const skill = new VaneResearchSkill({ baseUrl: 'http://127.0.0.1:3000' });
const result = await skill.execute({ query: 'What is TRM closed-loop research?' });
console.log(result);
```

For complete specification, timeout tiers, and architecture see [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) and [vane-research-trm-spec.md](../../docs/meta/vane-research-trm-spec.md).

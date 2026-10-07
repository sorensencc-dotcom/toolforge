# Benchmark Mistral Large Chonk

Evaluates Mistral Large 123B on large context buffers, multi-file AST refactoring, formal invariant synthesis, and cost arbitrage.

## Features
- **Large-Context Needle Retrieval**: Measures recall across 32k–128k context windows.
- **Multi-File AST Refactoring**: Validates complex cross-module refactoring outputs for syntax and dependency integrity.
- **Formal Invariant Synthesis**: Tests ability to generate valid Lean/state invariants from natural language specifications.
- **Cost Arbitrage Analysis**: Computes cost savings against Frontier baseline pricing ($3/$15 per 1M tokens).

## Usage

```typescript
import { MistralBenchmarkEngine } from './benchmark-engine.js';

const engine = new MistralBenchmarkEngine({ mockMode: true });
const results = await engine.runFullBenchmark(32768);
console.log(results.costMetrics.savingsPercent); // ~85.7%
```

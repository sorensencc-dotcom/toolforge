# Toolforge Writing Heuristics and Global Style Enforcement Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

��oal:** Build and activate a deterministic, AST-aware technical writing heuristics skill, zero-dependency CLI linter/fixer, and cross-platform instruction-surface distribution for all LLMs.

��rchitecture:** A canonical `heuristics.json` acts as the sole source of truth, compiled deterministically into `SKILL.md` and `docs/rules.md`. An AST-aware linter (`unified` + `remark-gfm`) evaluates prose while exempting code/tables, an atomic file-replacement engine applies safe autofixes with backup rollback, and a PowerShell junction script safely distributes the skill across Gemini, Claude, OpenCode, and Copilot.

**Tech Stack:** TypeScript, Node.js (CommonJS bundled runtime), `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `vitest`, PowerShell 7+.

## Global Constraints
- Canonical Spec: `docs/meta/specs/2026-08-18-writing-heuristics-skill-design.md`
- Zero Rule Drift: `heuristics.json` is the sole source of truth; `SKILL.md` and `docs/rules.md` are compiled artifacts verified in CI.
- Data Safety: No blind deletes in sync scripts; only verified junctions pointing to source may be manipulated.
- Safe Autofix: Only rules with Confidence >= 0.95 (`ban-throat-clearing` and `heading-sentence-case`) may be auto-mutated; sub-threshold rules are advisory only.
- Strict Stream Separation: When reading from stdin, diagnostic logs go strictly to `stderr` and transformed prose goes to `stdout`.

---

## File Structure

```
skills/writing-heuristics/
|-- skill.json                 # Toolforge capability contract and router intent
|-- heuristics.json            # Canonical rule catalog (source of truth)
|-- package.json               # Package definition and test/build scripts
|-- tsconfig.json              # TypeScript build configuration
|-- SKILL.md                   # Compiled LLM prompt instructions
|-- src/
|   |-- types.ts               # Shared interfaces
<   |-- compiler.ts           # Compiles heuristics.json -> SKILL.md & docs/rules.md
|   |-- parser.ts             # Remark AST parser with exemptions
|   |-- suppressions.ts       # HTML comment directive lexer
|   |-- linter.ts              # Core rule evaluation engine (11 rules)
|   |-- fixer.ts               # Atomic file replacement, EOL/BOM preservation,fix
|   |-- formatters.ts         # stylish, json, sarif formatters
|   |-- cli.ts                 # CLI entrypoint and stream separation
|   `-- index.ts               # Programmatic API for ./run-tool.ps1
|-- bin/
|   |-- compile.js             # Compilation runner script
|   |-- lint-heuristics.js     # Bundled standalone executable CLI (zero deps)
|   `-- sync-global.ps1        # Safe PowerShell junction manager
|-- tests/
|   |-- fixtures/              # Dedicated markdown test files
|   |-- codegen.test.ts        # Zero-drift compiler test
|   |-- parser.test.ts         # AST exemption & directive tests
|   |-- linter.test.ts         # 11-rule verification suite
|   |-- fixer.test.ts          # Atomic replacement & backup tests
|   `-- cli.test.ts            # Exit codes, formats, stdin/stderr tests
--- docs/
|   |-- index.md               # User and Operator Guide
|   `-- rules.md               # Compiled human rule reference manual
@`- README.md                  # Quick reference card
```

---

### Task 1: Package Scaffold, Type Definitions, and Canonical `heuristics.json`

**Files:**
- Create: `skills/writing-heuristics/package.json`
- Create: `skills/writing-heuristics/tsconfig.json`
- Create: `skills/writing-heuristics/src/types.ts`
- Create: `skills/writing-heuristics/heuristics.json`
- Create: `skills/writing-heuristics/skill.json`

**Interfaces:*
- Produces: `RuleDefinition`, `HeuristicsCatalog`, `Violation`, `LintResult`, `SuppressionDirective` types in `src/types.ts`.
- Produces: `heuristics.json` containing all 11 canonical rules with regex patterns, severities, confidence scores, and descriptions.

- [ ] **Step 1: Write `package.json` and `tsconfig.json`**
- [ ] **Step 2: Define TypeScript interfaces in `src/types.ts**
- [ ] **Step 3: Author the canonical `heuristics.json` with 11 rules**
- [ ] **Step 4: Create provisional `skill.json` with Toolforge metadata and router hint**
- [ ] **Step 5: Verify JSON validity using `node -e "JSON.parse(fs.readFileSync('heuristics.json'))"`**
- [ ] **Step 6: Commit**

``gbash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): scaffold package, types, and canonical heuristics.json"
```

---

### Task 2: Heuristics Compiler and Zero-Drift Codegen Test

��iles:**
- Create: `skills/writing-heuristics/src/compiler.ts`
- Create: `skills/writing-heuristics/bin/compile.js`
- Create: `skills/writing-heuristics/tests/codegen.test.ts`
- Output: `skills/writing-heuristics/SKILL.md`
- Output: `skills/writing-heuristics/docs/rules.md`
**Interfaces:**
- Consumes: `heuristics.json`, `src/types.ts`
- Produces: `compileCatalog(catalogPath: string): { skillMd: string, rulesMd: string }`

- [ ] **Step 1: Write failing codegen test in tests/codegen.test.ts**
- [ ] **Step 2: Implement compiler in src/compiler.ts**
- [ ] **Step 3: Create executable script in bin/compile.js and generate SKILL.md and docs/rules.md**
- [ ] **Step 4: Run npx vitest run tests/codegen.test.ts and verify it passes**
- [ ] **Step 5: Commit**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): implement deterministic compiler and zero-drift test"
```

---

### Task 3: AST Parser and Directive Suppression Lexer

**Files:*
- Create: `skills/writing-heuristics/src/parser.ts`
- Create: `skills/writing-heuristics/src/suppressions.ts`
- Create: `skills/writing-heuristics/tests/parser.test.ts`

**Interfaces:**
- Consumes: `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`
- Produces: `parseMarkdown(content: string): MarkdownAST`
- Produces: `extractSuppressions(ast: MarkdownAST): SuppressionRegistry`

- [ ] **Step 1: Write failing tests in tests/parser.test.ts (verifying table/code block exemptions and directive parsing)**
- [ ] **Step 2: Implement AST parser with node visitor in src/parser.ts**
- [ ] **Step 3: Implement suppression lexer in src/suppressions.u�̀�����ɍ������ѡ�Ȱ�ɕ�ͽ������������䤨�(��l�t���Mѕ����Iո�����٥ѕ�Ё�ո�ѕ��̽���͕ȹѕ�й�́Ѽ�ٕɥ��ѕ��́���̨�(��l�t���Mѕ��������Ш�()�����͠)��Ё����ͭ���̽�ɥѥ������ɥ�ѥ�̼)��Ё�����Ѐ�������С�ɥѥ������ɥ�ѥ�̤聥�������ЁMP����͕ȁ��������ɕ�ͥ�����ɕ�ѥٔ����Ȉ)���((���((����Q�ͬ����ɔ�Iձ��م�Յѥ�����������ā���������Iձ�̤((�������(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�Ɍ����ѕȹ�̀(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽���ѕȹѕ�й�̀(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽�����ɕ̽���̵�������(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽�����ɕ̽������ձ�̹���(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽�����ɕ̽����ɕ�͕�����((��%�ѕə����訨(�����յ��聁�Ɍ����͕ȹ�̀����Ɍ�����ɕ�ͥ��̹�̀������ɥ�ѥ�̹�ͽ��(��Aɽ�Ս��聁����Q��С���ѕ�����ɥ������ѥ�����1���=�ѥ��̤�1���I��ձр(��Aɽ�Ս��聁������������A�Ѡ���ɥ������ѥ�����1���=�ѥ��̤�Aɽ��͔�1���I��ձ���((��l�t���Mѕ����ɕ�є�ѕ�Ё�����ɕ́��ȁ�����ā�ձ�́������ѡ�ȁչ�Ёѕ��́���ѕ��̽���ѕȹѕ�й�̨�(��l�t���Mѕ����%�������Ё�ձ���م�Յѽ�́����Ɍ����ѕȹ�́��ȁ�����ā�����������ձ�̨�(��l�t���Mѕ����%�ѕ�Ʌє�����ɕ�ͥ������ѕɥ������������䁍����́��Ѽ��Ɍ����ѕȹ�̨�(��l�t���Mѕ����Iո�����٥ѕ�Ё�ո�ѕ��̽���ѕȹѕ�й�́����ٕɥ����������ͥ���Ʌє��(��l�t���Mѕ��������Ш�()�����͠)��Ё����ͭ���̽�ɥѥ������ɥ�ѥ�̼)��Ё�����Ѐ�������С�ɥѥ������ɥ�ѥ�̤聥�������Ё��ɔ��ɽ͔����ѕȁ�����ā�����������ձ���م�Յѽ�̈)���((���((����Q�ͬ���M�����������������ѽ��������I����������((������訨(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�Ɍ����ȹ�̀(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽���ȹѕ�й�̀((��%�ѕə����訨(�����յ��聁�Ɍ����ѕȹ�̀����Ɍ�����̹�̀(��Aɽ�Ս��聁�������̡���ѕ�����ɥ����٥���ѥ����Y����ѥ��mt��쁙�ᕑ��ѕ�����ɥ������������չ�聹յ��ȁ��(��Aɽ�Ս��聁ͅ������������A�Ѡ���ɥ������ѥ������=�ѥ��̤�Aɽ��͔������I��ձ���((��l�t���Mѕ����]ɥє���������ѕ��́���ѕ��̽���ȹѕ�й�̀���͕�ѥ������������������ԁ��є��I1��ɕ͕�مѥ������������ɕ�ѥ���������ѽ����ɕ��������Ф��(��l�t���Mѕ����%�������ЁMP���ɥ����Ʌ�͙�ɴ������������Ɍ����ȹ�̨�(��l�t���Mѕ����%�������Ё�ѽ����ɕ��������Ё͕�Օ���������Ʌ͠�ɕ��ٕ�䁥���Ɍ����ȹ�̨�(��l�t���Mѕ����Iո�����٥ѕ�Ё�ո�ѕ��̽���ȹѕ�й�́����ٕɥ�����ͥ����եє��(��l�t���Mѕ��������Ш�()�����͠)��Ё����ͭ���̽�ɥѥ������ɥ�ѥ�̼)��Ё�����Ѐ�������С�ɥѥ������ɥ�ѥ�̤聥�������Ёͅ�����ѽ�����������ݥѠ��ѽ����ɕ��������Ј)���((���((����Q�ͬ���1$�Iչ��Ȱ��ɵ��ѕ�̰�����Mх��������	ե���A�������(**����訨(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�Ɍ���ɵ��ѕ�̹�̀(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�Ɍ������̀(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�Ɍ�������̀(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽����ѕ�й�̀(��=�����聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�������е���ɥ�ѥ�̹�̀((��%�ѕə�����(��Aɽ�Ս���Mх����������ɼ���ѕɹ������������䁕ᕍ�х����1$��Ё��������е���ɥ�ѥ�̹�̀�(��Aɽ�Ս����ɵ���聁��履͡�����ͽ�����ͅɥ���ݥѠ���Ё����̀���İ�ȸ((��l�t���Mѕ����%�������Ё��ɵ��ѕ�̀���履͠���ͽ���ͅɥ�������Ɍ���ɵ��ѕ�̹�̨�(��l�t���Mѕ����%�������Ё1$��ɝյ��Ё���ͥ���������ɕ���͕��Ʌѥ�������Ɍ������̨�(��l�t���Mѕ����%�������Ё�ɽ�Ʌ���ѥ�����������Ё����Ɍ�������̨�(��l�t���Mѕ����������ɔ��ե���͍ɥ�Ѐ�������������������ͽ���������������������е���ɥ�ѥ�̹�̨�(��l�t���Mѕ����]ɥє�1$�����Ѽ�����ѕ��́���ѕ��̽����ѕ�й�́����ٕɥ�䁹���٥ѕ�Ё�ո�ѕ��̽����ѕ�й�̨�(��l�t���Mѕ��������Ш�()�����͠)��Ё����ͭ���̽�ɥѥ������ɥ�ѥ�̼)��Ё�����Ѐ�������С�ɥѥ������ɥ�ѥ�̤聥�������Ё1$��չ��Ȱ���ɵ��ѕ�̰������х���������ե���)���((���((����Q�ͬ���M����A�ݕ�M�����)չ�ѥ���5��������ЁM�ɥ��(**����訨(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽�����幌����������ŀ(��ɕ�є聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ѕ��̽�幌�͍ɥ�йѕ�й�̀((��%�ѕə����訨(��Aɽ�Ս���M�����չ�ѥ���������ȁݥѠ���Y�ɥ�倁������U����х�����ݥэ��̸(��ՅɅ�ѕ���I�����́չ��������хɝ�Ё��ѡ́����م����ѕ́ͽ�ɍ������ѥ��((��l�t���Mѕ�����ѡ�ȁ�����幌����������āݥѠ��幅����ͽ�ɍ��ɕͽ��ѥ��������ɔ������Ёم����ѥ����(��l�t���Mѕ����]ɥє�ѕ�Ё���ѕ��̽�幌�͍ɥ�йѕ�й�́ͥ�ձ�ѥ����չ�ѥ���ٕɥ����ѥ�������ɽ��������(��l�t���Mѕ����ᕍ�є���͠������幌����������Ā�Y�ɥ��Ѽ������ɴ��ɔ������Ё��ѕ�ɥ�䨨(��l�t���Mѕ��������Ш�()�����͠)��Ё����ͭ���̽�ɥѥ������ɥ�ѥ�̼)��Ё�����Ѐ�������С�ɥѥ������ɥ�ѥ�̤聅���ͅ���A�ݕ�M������չ�ѥ����幌�����ɽ�������͍ɥ�Ј)���((���((����Q�ͬ���%����Սѥ���M�ə����%�ѕ�Ʌѥ�����9QL������������Ф(**����訨(��5�����聁9QL�����Դ�ـ(��5�����聀���ѡՈ�������е�����Սѥ��̹���((��l�t���Mѕ����%����Ё��������Q==1=I�]I%Q%9�%M%A1%9���������Ѽ�9QL�������ݕ�������̀�Դ�ب�(��l�t���Mѕ����%����Ё���������ɥѥ�����͍���������������Ѽ����ѡՈ�������е�����Սѥ��̹����(��l�t���Mѕ����Y�ɥ��9QL������ѕ�ɥ�䁅�����ɵ�Ш�(��l�t���Mѕ��������Ш�()�����͠)��Ё����9QL�������ѡՈ�������е�����Սѥ��̹��)��Ё�����Ѐ�������̡��ٕɹ�����聥����Ё���������ɥѥ�����͍���������Ѽ�9QL��������������Ё�����Սѥ��̈)���((���((����Q�ͬ���еMх���5������Ё�ѥمѥ��������Ѽ����Y�ɥ����ѥ��(**����訨(��5�����聁�������й�ͽ��(��5�����聁ͭ���̽�ɥѥ������ɥ�ѥ�̽ͭ�����ͽ��(��5�����聁ͭ���̽M-%11,�Y1%Q%=8����((��l�t���Mѕ����Iո��ձ��ѕ�Ё�եє聹���ѕ�Ё��ͥ���ͭ���̽�ɥѥ������ɥ�ѥ�̀���������́ɕ�եɕ����(��l�t���Mѕ����ᕍ�є������幌����������āѼ������䁝�������չ�ѥ��́�����ո��Y�ɥ�䨨(��l�t���Mѕ����%�����ѕ�ѱ�����є��������й�ͽ��Ѽ���ѥمє�ͭ������х���耉��ѥٔ�������Ѡ��ٕɅ��耉��������(��l�t���Mѕ����U���є�ͭ�����ͽ��Ѽ�ɕ����Ёɕ���ѕɕ���хє��(��l�t���Mѕ����U���є�ͭ���̽M-%11A,�Y1%Q%=8�����(��l�t���Mѕ����Iո������ͭ���̽�ɥѥ������ɥ�ѥ�̽�������е���ɥ�ѥ�̹�́���������̼�Ѽ���������ѕ�Ш�(��l�t���Mѕ��������Ш�()�����͠)��Ё�����������й�ͽ��ͭ���̽�ɥѥ������ɥ�ѥ�̼�ͭ���̽M-%11A,�Y1%Q%=8���)��Ё�����Ѐ�������С�ɥѥ������ɥ�ѥ�̤聍�����є�е�х�����ѥمѥ�����є������������Ёɕ����Ʌѥ���)���(
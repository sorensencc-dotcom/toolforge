# Research store

Index Git research and exported Drive Markdown in Supabase; retrieve authorized chunks through MCP. Candidate integration for issue #124.

From repository root:

```bash
npm --prefix skills/research-store install --ignore-scripts
timeout 60s npm --prefix skills/research-store test
timeout 60s npm --prefix skills/research-store run test:live
```

Local tests include synthetic HTTP services and actual CLI/stdio processes. Live SQL tests require CLI login and explicit link to authorized test project; they roll back all test schema changes.

For setup conventions, requirements, inputs, outputs, and documentation navigation, use [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

External integrations: [Supabase by Supabase](https://github.com/supabase/supabase-js), [OpenAI SDK by OpenAI](https://github.com/openai/openai-node), [MCP SDK by Model Context Protocol contributors](https://github.com/modelcontextprotocol/typescript-sdk), and [js-yaml by Nodeca](https://github.com/nodeca/js-yaml). Toolforge owns parsing, guards, atomic indexing, and MCP handlers.

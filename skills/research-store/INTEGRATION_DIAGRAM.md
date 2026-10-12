# Research store integration

![Research store integration](docs/integration.png)

Git and exported Drive Markdown remain authoritative. Sync alone receives writer credentials. MCP uses authenticated readers under Supabase RLS; staging and production use separate projects and credentials.

<details><summary>Mermaid source</summary>

```mermaid
flowchart LR
    Sources[Git and Drive Markdown exports] --> Sync[Sync CLI]
    Sync -->|Service-role atomic replacement| DB[Supabase documents, chunks, and claims]
    Sync --> Embeddings[Approved embedding provider]
    Reader[Authenticated MCP client] --> MCP[Read-only MCP stdio]
    MCP -->|Signed reader JWT and RLS| DB
    MCP --> Embeddings
```

</details>

Rendered source: [Standalone integration diagram](docs/integration.html). Dev/UAT API acceptance uses deterministic loopback embeddings; real provider quality remains a rollout gate.

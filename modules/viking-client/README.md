# `@toolforge/viking-client`

Read-only client for the Viking VFS MCP resource protocol.

```js
import { createStdioTransport, VikingClient } from '@toolforge/viking-client';

const transport = createStdioTransport({
  command: 'node',
  args: ['modules/mcp/viking-vfs-server.mjs'],
  env: { VIKING_VAULT_ROOT: 'C:/dev/kb-sync', VIKING_VAULT_NAME: 'kb-sync' }
});
const client = new VikingClient({ transport });
await client.connect();
const evidence = await client.readWithPolicy('viking://kb-sync/sources/modules/auth.ts', { severity: 'P1' });
await client.close();
```

The client validates logical URIs, normalizes JSON-RPC errors, supports bounded batch reads, and records metadata-only telemetry. It never records resource content or physical paths.


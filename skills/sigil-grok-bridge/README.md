# Sigil Grok Bridge

Keyless Model Context Protocol (MCP) bridge exposing governed Sigil task submission and inbox inspection to Grok Bot.

## Quickstart

Start the MCP bridge over stdio:

```bash
node src/index.ts
```

Configure `SIGIL_CONNECTOR_URL` in the environment if the local connector is not listening on `http://127.0.0.1:4411`.

## Tools Provided

- `sigil_send_task`: Dispatches an asynchronous, cryptographically signed task to a Sigil worker.
- `sigil_check_inbox`: Inspects incoming notifications or task execution results from the local Sigil mailbox.

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for full operational parameters.

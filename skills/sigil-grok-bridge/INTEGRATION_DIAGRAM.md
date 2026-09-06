# Sigil Grok Bridge integration

```text
Grok Bot / External Caller
  |
  +--> MCP JSON-RPC (stdio)
         |
         v
  sigil-grok-bridge (Keyless Adapter)
         |
         +--> HTTP POST /v1/tasks (127.0.0.1:4411)
         +--> HTTP GET  /v1/inbox (127.0.0.1:4411)
         |
         v
  Sigil Connector Daemon (Holds Ed25519 Key, Performs JCS Signing & Capability Gating)
```

All operations isolate private keys to the local connector process and enforce fail-closed verification.

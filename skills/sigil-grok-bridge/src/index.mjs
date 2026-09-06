import readline from "node:readline";

const CONNECTOR_URL = process.env.SIGIL_CONNECTOR_URL || "http://127.0.0.1:4411";
const CONNECTOR_TOKEN = process.env.SIGIL_CONNECTOR_TOKEN || "token_local_dev";

function getConnectorHeaders(capabilityScope = "sigil.task/*") {
  const headers = {
    "Content-Type": "application/json",
    "x-sigil-request-id": `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    "x-sigil-contract": "sigil.connector/v1",
    "x-sigil-caller": "sigil-grok-bridge",
    "x-sigil-capability-scope": capabilityScope
  };
  if (CONNECTOR_TOKEN) {
    headers["Authorization"] = `Bearer ${CONNECTOR_TOKEN}`;
  }
  return headers;
}

const TOOLS = [
  {
    name: "sigil_send_task",
    description: "Dispatch an asynchronous, cryptographically signed task to a Sigil worker (e.g. Claude or Codex).",
    inputSchema: {
      type: "object",
      properties: {
        recipient_endpoint: { type: "string", description: "Target endpoint ID (e.g. ep_claude)" },
        recipient_owner: { type: "string", description: "Target owner identity" },
        conversation_id: { type: "string", description: "Authoritative conversation ID" },
        instruction: { type: "string", description: "Task instructions for the worker" },
        context_refs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string" },
              uri: { type: "string" },
              sha256: { type: "string" }
            },
            required: ["kind", "uri", "sha256"]
          },
          description: "Explicit, integrity-checked pointers to shared research or code"
        }
      },
      required: ["recipient_endpoint", "recipient_owner", "conversation_id", "instruction"]
    }
  },
  {
    name: "sigil_check_inbox",
    description: "Read incoming notifications or task execution results from the local Sigil mailbox.",
    inputSchema: {
      type: "object",
      properties: {
        since_cursor: { type: "string", description: "Durable resume cursor" },
        limit: { type: "number", default: 10 }
      }
    }
  }
];

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function error(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

export async function handleMcpMessage(message) {
  if (message.method === "initialize") {
    return reply(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "sigil-grok-bridge", version: "1.0.0" }
    });
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "tools/list") {
    return reply(message.id, { tools: TOOLS });
  }

  if (message.method === "tools/call") {
    const { name, arguments: args } = message.params || {};

    try {
      if (name === "sigil_send_task") {
        const payload = args || {};
        const envelope = payload.envelope || {
          protocol: "sigil/1",
          message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          conversation_id: payload.conversation_id,
          message_type: "task.request",
          recipient: {
            endpoint_id: payload.recipient_endpoint,
            owner_id: payload.recipient_owner
          },
          body: {
            instruction: payload.instruction
          },
          context_refs: payload.context_refs || [],
          capabilities: ["sigil.task/submit"],
          idempotency_key: `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        const res = await fetch(`${CONNECTOR_URL}/v1/tasks`, {
          method: "POST",
          headers: getConnectorHeaders("sigil.task/*"),
          body: JSON.stringify({ envelope })
        });

        if (!res.ok) {
          const errorText = await res.text();
          return reply(message.id, {
            content: [{ type: "text", text: `Connector Error (${res.status}): ${errorText}` }],
            isError: true
          });
        }

        const result = await res.json();
        return reply(message.id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      }

      if (name === "sigil_check_inbox") {
        const { since_cursor, limit = 10 } = args || {};
        const url = new URL(`${CONNECTOR_URL}/v1/inbox`);
        if (since_cursor) url.searchParams.set("since", since_cursor);
        url.searchParams.set("limit", limit.toString());

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: getConnectorHeaders("sigil.core/read_shared_context")
        });
        if (!res.ok) {
          return reply(message.id, {
            content: [{ type: "text", text: `Connector Error: ${res.statusText}` }],
            isError: true
          });
        }

        const result = await res.json();
        return reply(message.id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      }

      return reply(message.id, {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      });
    } catch (err) {
      return reply(message.id, {
        content: [{ type: "text", text: `Bridge Exception: ${err.message}` }],
        isError: true
      });
    }
  }

  if (message.id !== undefined) {
    return error(message.id, -32601, "Method not found");
  }
}

export function startMcpStdioServer(input = process.stdin) {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on("line", (line) => {
    try {
      const message = JSON.parse(line);
      Promise.resolve(handleMcpMessage(message)).catch((cause) => error(message.id, -32000, cause.message));
    } catch {
      error(null, -32700, "Invalid JSON");
    }
  });
  return rl;
}

if (process.env.NODE_ENV !== "test") {
  startMcpStdioServer();
}

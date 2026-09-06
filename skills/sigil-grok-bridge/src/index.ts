import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const CONNECTOR_URL = process.env.SIGIL_CONNECTOR_URL || "http://127.0.0.1:4411";

interface TaskPayload {
  recipient_endpoint: string;
  recipient_owner: string;
  conversation_id: string;
  instruction: string;
  context_refs?: Array<{ kind: string; uri: string; sha256: string }>;
}

export const server = new Server(
  { name: "sigil-grok-bridge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "sigil_send_task") {
      const payload = args as unknown as TaskPayload;
      const res = await fetch(`${CONNECTOR_URL}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          content: [{ type: "text", text: `Connector Error (${res.status}): ${errorText}` }],
          isError: true
        };
      }

      const result = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    if (name === "sigil_check_inbox") {
      const { since_cursor, limit = 10 } = (args as { since_cursor?: string; limit?: number }) || {};
      const url = new URL(`${CONNECTOR_URL}/v1/inbox`);
      if (since_cursor) url.searchParams.set("since", since_cursor);
      url.searchParams.set("limit", limit.toString());

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Connector Error: ${res.statusText}` }],
          isError: true
        };
      }

      const result = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Bridge Exception: ${err.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.env.NODE_ENV !== "test") {
  main().catch(console.error);
}

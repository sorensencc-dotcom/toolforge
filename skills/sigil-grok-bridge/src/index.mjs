import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

const CONNECTOR_URL = process.env.SIGIL_CONNECTOR_URL || "http://127.0.0.1:4411";

function resolveConnectorToken() {
  if (process.env.SIGIL_CONNECTOR_TOKEN) return process.env.SIGIL_CONNECTOR_TOKEN;
  const candidatePaths = [
    "C:\\dev\\sigil-repo\\.sigil\\grokbot.identity.json",
    path.resolve(process.cwd(), ".sigil/grokbot.identity.json"),
    path.resolve(process.cwd(), "sigil-repo/.sigil/grokbot.identity.json")
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const id = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (id.connector_token) return id.connector_token;
      }
    } catch {}
  }
  return "token_local_dev";
}

const CONNECTOR_TOKEN = resolveConnectorToken();

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
        const nowMs = Date.now();
        const taskId = payload.task_id || `task_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
        const envelope = payload.envelope || {
          protocol: "sigil/1",
          message_id: `msg_${nowMs}_${Math.random().toString(36).slice(2, 8)}`,
          conversation_id: payload.conversation_id,
          message_type: "task.request",
          recipient: {
            endpoint_id: payload.recipient_endpoint,
            owner_id: payload.recipient_owner
          },
          body: {
            task_id: taskId,
            instruction: payload.instruction
          },
          context_refs: payload.context_refs || [],
          capabilities: ["sigil.task/submit"],
          idempotency_key: `idem_${nowMs}_${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date(nowMs).toISOString(),
          expires_at: new Date(nowMs + 12 * 60 * 60 * 1000).toISOString()
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
  let buffer = "";
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on("line", (line) => {
    buffer += (buffer ? "\n" : "") + line;
    try {
      const message = JSON.parse(buffer);
      buffer = "";
      Promise.resolve(handleMcpMessage(message)).catch((cause) => error(message.id, -32000, cause.message));
    } catch {
      // Keep buffering until complete JSON is received
    }
  });
  rl.on("close", () => {
    if (buffer.trim()) {
      try {
        const message = JSON.parse(buffer);
        Promise.resolve(handleMcpMessage(message)).catch((cause) => error(message.id, -32000, cause.message));
      } catch {
        error(null, -32700, "Invalid JSON");
      }
    }
  });
  return rl;
}

if (process.env.NODE_ENV !== "test") {
  startMcpStdioServer();
}

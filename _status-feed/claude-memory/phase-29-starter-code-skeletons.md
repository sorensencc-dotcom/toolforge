---
name: phase-29-starter-code-skeletons
description: "TypeScript skeleton stubs for Phase 29.0; GraphStore, TorqueMapper, routes; drop-in ready"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bb1990c-6782-4cf5-9cba-f739dd4b8021
---

# Phase 29 Starter Code Skeletons

Drop-in TypeScript stubs for Phase 29.0 implementation.

---

## core/graph_store/GraphStore.ts

```typescript
// services/knowledge-graph/src/core/graph_store/GraphStore.ts

export type Node = {
  id: string;
  type: string;
  createdAt: string;
  updatedAt?: string;
  labels: Record<string, unknown>;
  properties: Record<string, unknown>;
};

export type Edge = {
  id: string;
  srcId: string;
  dstId: string;
  type: string;
  createdAt: string;
  properties: Record<string, unknown>;
};

export interface IGraphStore {
  createNode(node: Node): Promise<void>;
  getNode(id: string): Promise<Node | null>;
  findNodes(filter: Partial<Node>): Promise<Node[]>;

  createEdge(edge: Edge): Promise<void>;
  getEdge(id: string): Promise<Edge | null>;
  findEdges(filter: Partial<Edge>): Promise<Edge[]>;

  batchInsert(nodes: Node[], edges: Edge[]): Promise<void>;
}

export class SqliteGraphStore implements IGraphStore {
  constructor(private readonly dbPath: string) {}

  async createNode(node: Node): Promise<void> {
    // TODO: INSERT INTO nodes (id, type, created_at, labels, properties) VALUES (...)
  }

  async getNode(id: string): Promise<Node | null> {
    // TODO: SELECT * FROM nodes WHERE id = ?
    return null;
  }

  async findNodes(filter: Partial<Node>): Promise<Node[]> {
    // TODO: SELECT * FROM nodes WHERE type = ? (and/or other filters)
    return [];
  }

  async createEdge(edge: Edge): Promise<void> {
    // TODO: INSERT INTO edges (id, src_id, dst_id, type, created_at, properties) VALUES (...)
  }

  async getEdge(id: string): Promise<Edge | null> {
    // TODO: SELECT * FROM edges WHERE id = ?
    return null;
  }

  async findEdges(filter: Partial<Edge>): Promise<Edge[]> {
    // TODO: SELECT * FROM edges WHERE src_id = ? OR dst_id = ? OR type = ? (as filters)
    return [];
  }

  async batchInsert(nodes: Node[], edges: Edge[]): Promise<void> {
    // TODO: wrap in BEGIN TRANSACTION
    // TODO: insert all nodes
    // TODO: insert all edges
    // TODO: COMMIT
  }
}
```

---

## core/mappers/TorqueMapper.ts

```typescript
// services/knowledge-graph/src/core/mappers/TorqueMapper.ts

import { Node, Edge } from "../graph_store/GraphStore";
import { randomUUID } from "crypto";

export type TorqueEvent = {
  id: string;
  agent_id: string;
  timestamp: string;
  type: string;
  repo_id?: string;
  file_ids?: string[];
  metadata: Record<string, unknown>;
};

export type TorqueSignal = {
  id: string;
  kind: string;
  severity: string;
  timestamp: string;
  agent_id?: string;
  repo_id?: string;
  event_id?: string;
  metadata: Record<string, unknown>;
};

export type TorqueCorrelation = {
  id: string;
  signal_ids: string[];
  created_at: string;
  reason?: string;
  metadata: Record<string, unknown>;
};

export type TorqueBatch = {
  events: TorqueEvent[];
  signals: TorqueSignal[];
  correlations: TorqueCorrelation[];
};

export class TorqueMapper {
  static mapBatch(batch: TorqueBatch): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Map events → RunEvent nodes + AGENT_EXECUTED_EVENT, EVENT_TOUCHES_REPO, EVENT_TOUCHES_FILE edges
    for (const evt of batch.events) {
      nodes.push({
        id: evt.id,
        type: "RunEvent",
        createdAt: evt.timestamp,
        labels: { agent_id: evt.agent_id, event_type: evt.type },
        properties: evt.metadata,
      });

      edges.push({
        id: randomUUID(),
        srcId: evt.agent_id,
        dstId: evt.id,
        type: "AGENT_EXECUTED_EVENT",
        createdAt: evt.timestamp,
        properties: {},
      });

      if (evt.repo_id) {
        edges.push({
          id: randomUUID(),
          srcId: evt.id,
          dstId: evt.repo_id,
          type: "EVENT_TOUCHES_REPO",
          createdAt: evt.timestamp,
          properties: {},
        });
      }

      if (evt.file_ids) {
        for (const fileId of evt.file_ids) {
          edges.push({
            id: randomUUID(),
            srcId: evt.id,
            dstId: fileId,
            type: "EVENT_TOUCHES_FILE",
            createdAt: evt.timestamp,
            properties: {},
          });
        }
      }
    }

    // Map signals → Signal nodes + EVENT_EMITS_SIGNAL, SIGNAL_OBSERVED_ON_AGENT, SIGNAL_OBSERVED_ON_REPO edges
    for (const sig of batch.signals) {
      nodes.push({
        id: sig.id,
        type: "Signal",
        createdAt: sig.timestamp,
        labels: { kind: sig.kind, severity: sig.severity },
        properties: sig.metadata,
      });

      if (sig.event_id) {
        edges.push({
          id: randomUUID(),
          srcId: sig.event_id,
          dstId: sig.id,
          type: "EVENT_EMITS_SIGNAL",
          createdAt: sig.timestamp,
          properties: {},
        });
      }

      if (sig.agent_id) {
        edges.push({
          id: randomUUID(),
          srcId: sig.id,
          dstId: sig.agent_id,
          type: "SIGNAL_OBSERVED_ON_AGENT",
          createdAt: sig.timestamp,
          properties: {},
        });
      }

      if (sig.repo_id) {
        edges.push({
          id: randomUUID(),
          srcId: sig.id,
          dstId: sig.repo_id,
          type: "SIGNAL_OBSERVED_ON_REPO",
          createdAt: sig.timestamp,
          properties: {},
        });
      }
    }

    // Map correlations → CorrelationCluster nodes + PART_OF_CLUSTER edges
    for (const corr of batch.correlations) {
      nodes.push({
        id: corr.id,
        type: "CorrelationCluster",
        createdAt: corr.created_at,
        labels: { reason: corr.reason ?? "" },
        properties: corr.metadata,
      });

      for (const sigId of corr.signal_ids) {
        edges.push({
          id: randomUUID(),
          srcId: sigId,
          dstId: corr.id,
          type: "PART_OF_CLUSTER",
          createdAt: corr.created_at,
          properties: {},
        });
      }
    }

    return { nodes, edges };
  }
}
```

---

## api/routes/introspection/schema.ts

```typescript
// services/knowledge-graph/src/api/routes/introspection/schema.ts

import { Request, Response } from "express";

export function schemaRoute(req: Request, res: Response): void {
  res.json({
    nodes: [
      "RunEvent",
      "Signal",
      "CorrelationCluster",
      "Agent",
      "Repo",
      "File",
      "Commit",
      "GovernanceRecord",
      "AuditEvent",
      "Policy",
      "Constraint",
      "Amendment",
    ],
    edges: [
      "AGENT_EXECUTED_EVENT",
      "EVENT_TOUCHES_REPO",
      "EVENT_TOUCHES_FILE",
      "EVENT_EMITS_SIGNAL",
      "SIGNAL_OBSERVED_ON_AGENT",
      "SIGNAL_OBSERVED_ON_REPO",
      "PART_OF_CLUSTER",
      "CORRELATED_WITH",
      "EVENT_AUTHORED_BY_AGENT",
      "RECORD_AMENDS_POLICY",
      "RECORD_CREATES_CONSTRAINT",
    ],
    properties: {
      nodes: {
        RunEvent: ["agent_id", "event_type"],
        Signal: ["kind", "severity"],
        CorrelationCluster: ["reason"],
        Agent: [],
        Repo: ["health_score", "last_commit_at"],
        File: ["path", "size", "modified_at"],
        Commit: ["hash", "author", "timestamp"],
      },
    },
  });
}
```

---

## api/routes/introspection/stats.ts

```typescript
// services/knowledge-graph/src/api/routes/introspection/stats.ts

import { Request, Response } from "express";
import { IGraphStore } from "../../core/graph_store/GraphStore";

export function statsRoute(store: IGraphStore) {
  return async (req: Request, res: Response): Promise<void> => {
    // TODO: query store for node/edge counts
    // TODO: compute graph density (edges / potential edges)
    // TODO: get last ingestion timestamp

    res.json({
      nodes: {
        total: 0,
        byType: {},
      },
      edges: {
        total: 0,
        byType: {},
      },
      density: 0,
      lastIngestionAt: null,
    });
  };
}
```

---

## api/server.ts

```typescript
// services/knowledge-graph/src/api/server.ts

import express, { Express, Request, Response } from "express";
import { IGraphStore } from "../core/graph_store/GraphStore";
import { schemaRoute } from "./routes/introspection/schema";
import { statsRoute } from "./routes/introspection/stats";

export function createServer(store: IGraphStore): Express {
  const app = express();

  app.use(express.json());

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Introspection
  app.get("/api/knowledge-graph/schema", schemaRoute);
  app.get("/api/knowledge-graph/stats", statsRoute(store));

  // TODO: add /ingest/* routes
  // TODO: add /query/* routes

  // Error handler
  app.use((err: Error, req: Request, res: Response) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}

export async function startServer(store: IGraphStore, port: number = 3100): Promise<void> {
  const app = createServer(store);
  app.listen(port, () => {
    console.log(`Knowledge Graph service listening on port ${port}`);
  });
}
```

---

## tests/unit/graph_store.test.ts

```typescript
// services/knowledge-graph/tests/unit/graph_store.test.ts

import { describe, it, expect, beforeEach } from "@jest/globals";
import { SqliteGraphStore, Node, Edge } from "../../src/core/graph_store/GraphStore";
import { randomUUID } from "crypto";

describe("SqliteGraphStore", () => {
  let store: SqliteGraphStore;

  beforeEach(() => {
    store = new SqliteGraphStore(":memory:");
    // TODO: initialize DB (run migrations)
  });

  describe("createNode / getNode", () => {
    it("should create and retrieve a node", async () => {
      const node: Node = {
        id: randomUUID(),
        type: "RunEvent",
        createdAt: new Date().toISOString(),
        labels: { agent_id: "agent-1" },
        properties: { status: "success" },
      };

      await store.createNode(node);
      const retrieved = await store.getNode(node.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe("RunEvent");
    });
  });

  describe("findNodes", () => {
    it("should find nodes by type", async () => {
      // TODO: create multiple nodes of different types
      // TODO: call findNodes with type filter
      // TODO: verify results
    });
  });

  describe("createEdge / getEdge", () => {
    it("should create and retrieve an edge", async () => {
      // TODO: create source and dest nodes
      // TODO: create edge between them
      // TODO: retrieve edge
    });
  });

  describe("batchInsert", () => {
    it("should atomically insert nodes and edges", async () => {
      // TODO: create batch of nodes/edges
      // TODO: call batchInsert
      // TODO: verify all inserted
      // TODO: verify rollback on error (if edge FK violated)
    });
  });
});
```

---

## tests/unit/mappers/torque_mapper.test.ts

```typescript
// services/knowledge-graph/tests/unit/mappers/torque_mapper.test.ts

import { describe, it, expect } from "@jest/globals";
import { TorqueMapper, TorqueBatch } from "../../../src/core/mappers/TorqueMapper";

describe("TorqueMapper", () => {
  describe("mapBatch", () => {
    it("should map event → RunEvent node + AGENT_EXECUTED_EVENT edge", () => {
      const batch: TorqueBatch = {
        events: [
          {
            id: "evt-1",
            agent_id: "agent-1",
            timestamp: "2025-01-01T10:00:00Z",
            type: "build",
            metadata: { branch: "main" },
          },
        ],
        signals: [],
        correlations: [],
      };

      const { nodes, edges } = TorqueMapper.mapBatch(batch);

      expect(nodes.some((n) => n.id === "evt-1" && n.type === "RunEvent")).toBe(true);
      expect(edges.some((e) => e.srcId === "agent-1" && e.dstId === "evt-1" && e.type === "AGENT_EXECUTED_EVENT")).toBe(true);
    });

    it("should map event with repo → EVENT_TOUCHES_REPO edge", () => {
      const batch: TorqueBatch = {
        events: [
          {
            id: "evt-2",
            agent_id: "agent-1",
            timestamp: "2025-01-01T10:00:00Z",
            type: "build",
            repo_id: "repo-42",
            metadata: {},
          },
        ],
        signals: [],
        correlations: [],
      };

      const { edges } = TorqueMapper.mapBatch(batch);

      expect(edges.some((e) => e.srcId === "evt-2" && e.dstId === "repo-42" && e.type === "EVENT_TOUCHES_REPO")).toBe(true);
    });

    it("should map signal → Signal node + EVENT_EMITS_SIGNAL edge", () => {
      const batch: TorqueBatch = {
        events: [],
        signals: [
          {
            id: "sig-1",
            kind: "drift",
            severity: "high",
            timestamp: "2025-01-01T10:05:00Z",
            event_id: "evt-1",
            metadata: { drift_type: "config" },
          },
        ],
        correlations: [],
      };

      const { nodes, edges } = TorqueMapper.mapBatch(batch);

      expect(nodes.some((n) => n.id === "sig-1" && n.type === "Signal")).toBe(true);
      expect(edges.some((e) => e.srcId === "evt-1" && e.dstId === "sig-1" && e.type === "EVENT_EMITS_SIGNAL")).toBe(true);
    });

    it("should map correlation → CorrelationCluster node + PART_OF_CLUSTER edges", () => {
      const batch: TorqueBatch = {
        events: [],
        signals: [],
        correlations: [
          {
            id: "corr-1",
            signal_ids: ["sig-1", "sig-2"],
            created_at: "2025-01-01T10:06:00Z",
            reason: "config drift",
            metadata: {},
          },
        ],
      };

      const { nodes, edges } = TorqueMapper.mapBatch(batch);

      expect(nodes.some((n) => n.id === "corr-1" && n.type === "CorrelationCluster")).toBe(true);
      expect(edges.filter((e) => e.dstId === "corr-1" && e.type === "PART_OF_CLUSTER").length).toBe(2);
    });
  });
});
```

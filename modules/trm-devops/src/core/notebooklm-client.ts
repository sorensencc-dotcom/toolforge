import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface NotebookLMConfig {
  notebookId?: string;
  offlineBufferDir?: string;
  endpointUrl?: string;
}

export class NotebookLMClient {
  public notebookId: string;
  public offlineBufferDir: string;
  private endpointUrl?: string;

  constructor(config: NotebookLMConfig = {}) {
    this.notebookId = config.notebookId || "cb0498ce-1ea5-4668-9f65-ac368753404e";
    this.offlineBufferDir = config.offlineBufferDir || "dev/triage/.cache/pending-sync";
    this.endpointUrl = config.endpointUrl;
  }

  stageOfflineChunk(rawPayload: any): string {
    fs.mkdirSync(this.offlineBufferDir, { recursive: true });
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(rawPayload))
      .digest("hex")
      .slice(0, 8);
    const fileName = `${Date.now()}-${hash}.json`;
    const filePath = path.join(this.offlineBufferDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(rawPayload, null, 2), "utf8");
    return filePath;
  }

  async drainOfflineBuffer(): Promise<any[]> {
    if (!fs.existsSync(this.offlineBufferDir)) return [];
    const files = fs.readdirSync(this.offlineBufferDir).filter((f) => f.endsWith(".json"));
    const items: any[] = [];

    for (const file of files) {
      const fullPath = path.join(this.offlineBufferDir, file);
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        items.push(JSON.parse(content));
        fs.unlinkSync(fullPath);
      } catch (e) {}
    }
    return items;
  }

  async fetchOperationalChunks(): Promise<any[]> {
    const offlineItems = await this.drainOfflineBuffer();
    return offlineItems;
  }

  async deleteSource(sourceId: string): Promise<boolean> {
    if (!sourceId || sourceId === "LOCAL") return true;
    return true;
  }
}

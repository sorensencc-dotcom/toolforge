import http from "http";
import fs from "node:fs";
import path from "node:path";
import url from "url";

const ROOT = "C:/dev/toolforge";
const MANIFEST = path.join(ROOT, "manifest.json");

function loadManifest() {
  const data = fs.readFileSync(MANIFEST, "utf-8");
  return JSON.parse(data);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (parsed.pathname === "/tools") {
    try {
      const manifest = loadManifest();
      let tools = manifest.tools || [];

      const category = parsed.query.category as string | undefined;
      const search = parsed.query.search as string | undefined;

      if (category) {
        tools = tools.filter(t => t.category === category);
      }

      if (search) {
        const s = search.toLowerCase();
        tools = tools.filter(
          t =>
            t.name.toLowerCase().includes(s) ||
            (t.description || "").toLowerCase().includes(s)
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tools }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "manifest not available" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(8080, () => {
  console.log("Toolforge API v2 listening on http://localhost:8080");
});

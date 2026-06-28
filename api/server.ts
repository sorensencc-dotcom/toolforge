import http from "http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/dev/toolforge";
const MANIFEST = path.join(ROOT, "manifest.json");

const server = http.createServer((req, res) => {
  if (req.url === "/tools") {
    try {
      const data = fs.readFileSync(MANIFEST, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "manifest not available" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(8080, () => {
  console.log("Toolforge API listening on http://localhost:8080");
});
	`
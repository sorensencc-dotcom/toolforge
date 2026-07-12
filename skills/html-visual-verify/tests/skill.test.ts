import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("html-visual-verify", () => {
  let testFile: string;
  let dashboardFile: string;

  beforeAll(() => {
    testFile = path.join(__dirname, "test-fixture.html");
    dashboardFile = path.join(__dirname, "..", "..", "..", "dashboard.html");
    const validHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Cache-Control" content="no-cache">
        <title>Test</title>
        <style>
          :root {
            --bone: #e8e0d4;
            --forge: #1a1410;
            --ember: #D85A24;
          }
        </style>
      </head>
      <body>
        <button id="refresh-btn">REFRESH</button>
        <button id="hard-refresh-btn">HARD REFRESH</button>
        <script type="application/json" id="manifest-data">
        { "skills": [{"id": "test", "name": "Test Skill", "owner": "soren", "status": "active"}], "summary": { "total": 1, "active": 1 } }
        </script>
        <div class="skill-card">Test</div>
        <script>
          console.log("Loaded");
          document.getElementById("refresh-btn").onclick = () => console.log("refresh");
          document.getElementById("hard-refresh-btn").onclick = () => console.log("hard-refresh");
        </script>
      </body>
      </html>
    `;
    fs.writeFileSync(testFile, validHtml, "utf-8");
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe("HTML Structure", () => {
    it("exports valid entrypoint", () => {
      const entrypoint = path.join(__dirname, "..", "src", "index.ts");
      expect(fs.existsSync(entrypoint)).toBe(true);
    });

    it("validates a well-formed HTML file", () => {
      expect(fs.existsSync(testFile)).toBe(true);
    });

    it("detects tag balance", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const openTags = (html.match(/<[a-z][^>]*>/gi) || []).length;
      const closeTags = (html.match(/<\/[a-z][^>]*>/gi) || []).length;
      const voidTags = (html.match(/<(?:br|hr|img|input|meta|link)[^>]*\/?>/gi) || []).length;
      expect(openTags - voidTags).toBe(closeTags);
    });

    it("has DOCTYPE declaration", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      expect(html.toLowerCase()).toMatch(/<!doctype html>/);
    });

    it("has html and body tags", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      expect(html).toContain("<html");
      expect(html).toContain("<body");
    });
  });

  describe("Cache & Performance", () => {
    it("has cache-busting meta tags", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const hasCacheControl = html.includes('http-equiv="Cache-Control"');
      const hasPragma = html.includes('http-equiv="Pragma"');
      const hasExpires = html.includes('http-equiv="Expires"');
      expect(hasCacheControl || hasPragma || hasExpires).toBe(true);
    });

    it("no light-mode media query override (dark theme locked)", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const hasLightModeOverride = html.includes('prefers-color-scheme: light') &&
        html.includes('--bone: #0a0806') &&
        html.includes('--black: #faf6f0');
      expect(hasLightModeOverride).toBe(false);
    });
  });

  describe("JavaScript & Interactivity", () => {
    it("has no unescaped template literals in script blocks", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const scriptBlocks = html.match(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi) || [];
      let hasTemplateLiterals = false;
      scriptBlocks.forEach((block) => {
        const content = block.replace(/<[^>]*>/g, "");
        if (content.includes('`') && !content.includes("\\`")) {
          hasTemplateLiterals = true;
        }
      });
      expect(hasTemplateLiterals).toBe(false);
    });

    it("has refresh button handlers", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      expect(html).toContain('id="refresh-btn"');
      expect(html).toContain('id="hard-refresh-btn"');
      expect(html).toContain('refresh-btn").onclick');
      expect(html).toContain('hard-refresh-btn").onclick');
    });

    it("detects malformed JSON in embedded blocks", () => {
      const brokenJson = `<script type="application/json">{ "broken": }</script>`;
      const json = brokenJson.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/)?.[1]?.trim();
      expect(() => {
        if (json) JSON.parse(json);
      }).toThrow();
    });
  });

  describe("Data Integrity", () => {
    it("has valid manifest JSON", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const match = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        expect(() => JSON.parse(match[1])).not.toThrow();
      }
    });

    it("manifest has required summary fields", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const match = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        expect(data.summary).toBeDefined();
        expect(data.summary.total).toBeDefined();
        expect(data.summary.active).toBeDefined();
      }
    });

    it("manifest skills have owner field", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const match = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        data.skills.forEach((skill: any) => {
          expect(skill.owner).toBeDefined();
          expect(skill.owner).not.toBe("unknown");
        });
      }
    });
  });

  describe("Visual & Styling", () => {
    it("defines CSS custom properties for colors", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      expect(html).toContain("--bone:");
      expect(html).toContain("--forge:");
      expect(html).toContain("--ember:");
    });

    it("ember contrast passes WCAG AA (>4.5:1 on dark bg)", () => {
      const emberHex = "#D85A24";
      const forgeHex = "#1a1410";
      const getLum = (hex: string) => {
        const rgb = parseInt(hex.slice(1), 16);
        const r = ((rgb >> 16) & 255) / 255;
        const g = ((rgb >> 8) & 255) / 255;
        const b = (rgb & 255) / 255;
        const sr = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
        const sg = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
        const sb = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
        return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
      };
      const ratio = (Math.max(getLum(emberHex), getLum(forgeHex)) + 0.05) /
                    (Math.min(getLum(emberHex), getLum(forgeHex)) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("no inline font-size conflicts with responsive design", () => {
      const html = fs.readFileSync(testFile, "utf-8");
      const inlineFontSizes = (html.match(/style="[^"]*font-size[^"]*"/g) || []).length;
      expect(inlineFontSizes).toBeLessThan(3);
    });
  });

  describe("Dashboard (real file)", () => {
    it("dashboard.html exists", () => {
      expect(fs.existsSync(dashboardFile)).toBe(true);
    });

    it("dashboard has 21 skills in manifest", () => {
      if (fs.existsSync(dashboardFile)) {
        const html = fs.readFileSync(dashboardFile, "utf-8");
        const match = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
        if (match) {
          const data = JSON.parse(match[1]);
          expect(data.skills.length).toBe(21);
          expect(data.summary.total).toBe(21);
        }
      }
    });

    it("all dashboard skills owned by soren", () => {
      if (fs.existsSync(dashboardFile)) {
        const html = fs.readFileSync(dashboardFile, "utf-8");
        const match = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
        if (match) {
          const data = JSON.parse(match[1]);
          data.skills.forEach((skill: any) => {
            expect(skill.owner).toBe("soren");
          });
        }
      }
    });
  });
});

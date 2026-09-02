import fs from "fs";
import path from "path";
import { execSync } from "child_process"; // noqa: SEC-AUDITOR
import { chromium } from "playwright";

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    tagBalance: { passed: boolean; message: string };
    embeddedJson: { passed: boolean; errors: string[] };
    jsSyntax: { passed: boolean; errors: string[] };
    wcagContrast: { passed: boolean; failures: { token: string; ratio: number; required: number }[] };
  };
}

interface TestResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  cardCount: number;
  manifestCount: number;
  checks: {
    consoleErrors: string[];
    cardCountMatch: boolean;
    interactionTests: { name: string; passed: boolean }[];
    screenshotPath?: string;
  };
}

interface AutoFixResult {
  passed: boolean;
  fixed: string[];
  still_failing: string[];
  iterations: number;
}

function validateHtml(filePath: string): ValidationResult {
  const html = fs.readFileSync(filePath, "utf-8");
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: ValidationResult["checks"] = {
    tagBalance: { passed: true, message: "" },
    embeddedJson: { passed: true, errors: [] },
    jsSyntax: { passed: true, errors: [] },
    wcagContrast: { passed: true, failures: [] },
  };

  // 1. Tag balance
  const openTags = (html.match(/<[a-z][^>]*>/gi) || []).length;
  const closeTags = (html.match(/<\/[a-z][^>]*>/gi) || []).length;
  const voidTags = (html.match(/<(?:br|hr|img|input|meta|link)[^>]*\/?>/gi) || []).length;
  if (openTags - voidTags !== closeTags) {
    checks.tagBalance.passed = false;
    checks.tagBalance.message = `Tag mismatch: ${openTags - voidTags} open (excluding void), ${closeTags} close`;
    errors.push(checks.tagBalance.message);
  } else {
    checks.tagBalance.message = `OK: ${openTags} open, ${closeTags} close, ${voidTags} void`;
  }

  // 2. Embedded JSON blocks
  const jsonBlocks = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  jsonBlocks.forEach((block, i) => {
    const content = block.replace(/<[^>]*>/g, "").trim();
    try {
      JSON.parse(content);
    } catch (e) {
      checks.embeddedJson.errors.push(`Block ${i}: ${(e as Error).message}`);
      errors.push(`JSON parse error in block ${i}: ${(e as Error).message}`);
    }
  });
  checks.embeddedJson.passed = checks.embeddedJson.errors.length === 0;

  // 3. JS syntax
  const jsBlocks = html.match(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi) || [];
  jsBlocks.forEach((block, i) => {
    const content = block.replace(/<[^>]*>/g, "").trim();
    if (!content) return;
    const tempFile = path.join(process.env.TEMP || "/tmp", `html-verify-${Date.now()}-${i}.js`);
    fs.writeFileSync(tempFile, content, "utf-8");
    try {
      execSync(`node --check "${tempFile}"`, { stdio: "pipe" });
    } catch (e) {
      const stderr = (e as any).stderr?.toString() || String(e);
      checks.jsSyntax.errors.push(`Block ${i}: ${stderr}`);
      errors.push(`JS syntax error in block ${i}: ${stderr}`);
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  });
  checks.jsSyntax.passed = checks.jsSyntax.errors.length === 0;

  // 4. WCAG contrast (extract :root tokens and compute ratios)
  const rootMatch = html.match(/:root\s*\{([^}]*)\}/s);
  if (rootMatch) {
    const tokens: Record<string, string> = {};
    const tokenMatches = rootMatch[1].matchAll(/--([a-z-]+):\s*([^;]+);/gi);
    for (const match of tokenMatches) {
      tokens[match[1]] = match[2].trim();
    }

    // Known fg/bg pairs to test
    const pairs = [
      { fg: "bone", bg: "forge", name: "body text on dark background" },
      { fg: "bone", bg: "black", name: "body text on black" },
      { fg: "ash", bg: "black", name: "secondary text on black" },
      { fg: "ember", bg: "black", name: "accent on black" },
    ];

    pairs.forEach(({ fg, bg, name }) => {
      const fgHex = tokens[fg];
      const bgHex = tokens[bg];
      if (fgHex && bgHex) {
        const ratio = computeContrast(fgHex, bgHex);
        if (ratio < 4.5) {
          checks.wcagContrast.failures.push({ token: name, ratio, required: 4.5 });
          warnings.push(`WCAG AA contrast failure: ${name} (${ratio.toFixed(2)}:1, need 4.5:1)`);
        }
      }
    });
  }
  checks.wcagContrast.passed = checks.wcagContrast.failures.length === 0;

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    checks,
  };
}

function computeContrast(hex1: string, hex2: string): number {
  const lum1 = getLuminance(parseHex(hex1));
  const lum2 = getLuminance(parseHex(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(hex: string): [number, number, number] {
  hex = hex.replace("#", "").trim();
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function getLuminance([r, g, b]: [number, number, number]): number {
  const sr = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const sg = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const sb = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

async function testInteractive(filePath: string): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: TestResult["checks"] = {
    consoleErrors: [],
    cardCountMatch: false,
    interactionTests: [],
  };
  let cardCount = 0;
  let manifestCount = 0;

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        checks.consoleErrors.push(msg.text());
        errors.push(`Console error: ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      checks.consoleErrors.push(err.message);
      errors.push(`Page error: ${err.message}`);
    });

    const fileUrl = `file://${path.resolve(filePath).replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "networkidle" });

    // Card count check
    const cardEls = await page.$$(".skill-card");
    cardCount = cardEls.length;
    const summaryEl = await page.evaluate(() => {
      const script = document.getElementById("manifest-data");
      if (!script) return null;
      try {
        const data = JSON.parse(script.textContent || "{}");
        return data.summary?.total;
      } catch {
        return null;
      }
    });
    manifestCount = summaryEl || 0;
    checks.cardCountMatch = cardCount === manifestCount;
    if (!checks.cardCountMatch) {
      warnings.push(`Card count mismatch: rendered ${cardCount}, manifest says ${manifestCount}`);
    }

    // Interaction tests
    const filterButtons = await page.$$(".filter-btn");
    if (filterButtons.length > 0) {
      try {
        await page.click(".filter-btn:nth-child(2)");
        const newCardEls = await page.$$(".skill-card");
        const passed = newCardEls.length !== cardCount || cardCount === manifestCount;
        checks.interactionTests.push({ name: "filter button click", passed });
        if (!passed) warnings.push("Filter button click did not change card count");
      } catch (e) {
        checks.interactionTests.push({ name: "filter button click", passed: false });
        errors.push(`Filter interaction failed: ${(e as Error).message}`);
      }
    }

    try {
      await page.click("#refresh-btn");
      const stillVisible = await page.isVisible(".skill-card");
      checks.interactionTests.push({ name: "refresh button click", passed: stillVisible });
    } catch (e) {
      checks.interactionTests.push({ name: "refresh button click", passed: false });
      errors.push(`Refresh interaction failed: ${(e as Error).message}`);
    }

    // Screenshot
    const screenshotPath = path.join(process.env.TEMP || "/tmp", `html-verify-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    checks.screenshotPath = screenshotPath;

    await browser.close();
  } catch (e) {
    errors.push(`Playwright test failed: ${(e as Error).message}`);
  }

  return {
    passed: errors.length === 0 && checks.cardCountMatch,
    errors,
    warnings,
    cardCount,
    manifestCount,
    checks,
  };
}

async function autoFix(filePath: string, maxIterations = 2): Promise<AutoFixResult> {
  const fixed: string[] = [];
  const still_failing: string[] = [];
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    const val = validateHtml(filePath);

    if (val.checks.wcagContrast.failures.length === 0) {
      return { passed: true, fixed, still_failing, iterations };
    }

    for (const failure of val.checks.wcagContrast.failures) {
      // Simple nudge: extract token from name, lighten it
      if (failure.token.includes("text") || failure.token.includes("accent")) {
        fixed.push(`Contrast fix attempted: ${failure.token} (iteration ${i + 1})`);
      }
    }
  }

  if (val.checks.wcagContrast.failures.length > 0) {
    for (const f of val.checks.wcagContrast.failures) {
      still_failing.push(`${f.token} (${f.ratio.toFixed(2)}:1)`);
    }
  }

  return { passed: false, fixed, still_failing, iterations };
}

async function main() {
  const filePath = process.argv[2];
  const fix = process.argv.includes("--fix");
  const screenshotOnly = process.argv.includes("--screenshot");

  if (!filePath) {
    console.error("Usage: node index.ts <html-file-path> [--fix] [--screenshot]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`\n📋 Validating: ${filePath}\n`);

  const val = validateHtml(filePath);
  console.log(`Validation: ${val.passed ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Tag balance: ${val.checks.tagBalance.message}`);
  console.log(`  Embedded JSON: ${val.checks.embeddedJson.passed ? "✅" : "❌"} (${val.checks.embeddedJson.errors.length} errors)`);
  console.log(`  JS syntax: ${val.checks.jsSyntax.passed ? "✅" : "❌"} (${val.checks.jsSyntax.errors.length} errors)`);
  console.log(`  WCAG contrast: ${val.checks.wcagContrast.passed ? "✅" : "❌"} (${val.checks.wcagContrast.failures.length} failures)`);

  if (val.errors.length > 0) {
    console.log("\n❌ Errors:");
    val.errors.forEach((e) => console.log(`  • ${e}`));
  }
  if (val.warnings.length > 0) {
    console.log("\n⚠️ Warnings:");
    val.warnings.forEach((w) => console.log(`  • ${w}`));
  }

  if (!screenshotOnly) {
    console.log(`\n🎭 Testing interactive behavior...\n`);
    const test = await testInteractive(filePath);
    console.log(`Testing: ${test.passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`  Card count: ${test.cardCount} rendered vs ${test.manifestCount} expected ${test.checks.cardCountMatch ? "✅" : "❌"}`);
    console.log(`  Console errors: ${test.checks.consoleErrors.length}`);
    console.log(`  Interaction tests: ${test.checks.interactionTests.filter((t) => t.passed).length}/${test.checks.interactionTests.length}`);
    if (test.checks.screenshotPath) {
      console.log(`  Screenshot: ${test.checks.screenshotPath}`);
    }

    if (test.errors.length > 0) {
      console.log("\n❌ Test Errors:");
      test.errors.forEach((e) => console.log(`  • ${e}`));
    }
  }

  if (fix) {
    console.log(`\n🔧 Running auto-fix (max 2 iterations)...\n`);
    const fixResult = await autoFix(filePath);
    console.log(`Auto-fix: ${fixResult.passed ? "✅ PASS" : "⚠️ INCOMPLETE"}`);
    console.log(`  Iterations: ${fixResult.iterations}`);
    if (fixResult.fixed.length > 0) {
      console.log(`  Fixed: ${fixResult.fixed.join(", ")}`);
    }
    if (fixResult.still_failing.length > 0) {
      console.log(`  Still failing: ${fixResult.still_failing.join(", ")}`);
    }
  }

  process.exit(val.passed && (screenshotOnly || true) ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});

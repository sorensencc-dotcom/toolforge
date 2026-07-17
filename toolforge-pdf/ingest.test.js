import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { ingest } from "./server.js";

const FIXTURE = resolve(
  import.meta.dirname,
  "../cic-ingestion/pdf/incoming/64-167-65_SorensenCharlesE.pdf"
);

test("ingest() extracts real text, not the xberg-mock placeholder", async () => {
  const result = await ingest({ file: FIXTURE });

  assert.equal(result.data.status, "success");
  assert.ok(result.data.page_count > 1000, "expected a multi-hundred-page real PDF");
  assert.ok(result.data.pages.length > 0);

  const firstPageText = result.data.pages[0].text;
  assert.ok(
    !firstPageText.includes("mock extracted text"),
    "regression: ingest() is returning xberg-mock placeholder text again"
  );
  assert.match(firstPageText, /Sorensen/i);
});

test("ingest() rejects missing file argument", async () => {
  await assert.rejects(() => ingest({}), /Missing required argument: file/);
});

test("ingest() rejects non-PDF paths", async () => {
  await assert.rejects(
    () => ingest({ file: resolve(import.meta.dirname, "./manifest.json") }),
    /Refusing to process non-PDF path/
  );
});

test("ingest() rejects a PDF path that does not exist", async () => {
  await assert.rejects(
    () => ingest({ file: resolve(import.meta.dirname, "./nonexistent.pdf") }),
    /File not found/
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FileLock } from "../src/core/lock.ts";
import * as trmDevops from "../src/index.ts";

test("FileLock basic acquire and release", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-basic-"));
  const targetFile = path.join(tmpDir, "data.json");
  const lock = new FileLock(targetFile);

  assert.equal(lock.lockPath, `${targetFile}.lock`);
  assert.equal(fs.existsSync(lock.lockPath), false);

  const acquired = await lock.acquire();
  assert.equal(acquired, true);
  assert.equal(fs.existsSync(lock.lockPath), true);

  const content = JSON.parse(fs.readFileSync(lock.lockPath, "utf-8"));
  assert.equal(content.pid, process.pid);
  assert.equal(typeof content.time, "number");

  lock.release();
  assert.equal(fs.existsSync(lock.lockPath), false);

  // Releasing again should not throw
  assert.doesNotThrow(() => lock.release());

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileLock throws error on timeout when lock is held", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-timeout-"));
  const targetFile = path.join(tmpDir, "data.json");

  const lock1 = new FileLock(targetFile, 5000);
  const lock2 = new FileLock(targetFile, 150);

  await lock1.acquire();
  assert.equal(fs.existsSync(lock1.lockPath), true);

  await assert.rejects(
    async () => {
      await lock2.acquire();
    },
    (err: Error) => {
      assert.match(err.message, /timeout|lock/i);
      return true;
    }
  );

  lock1.release();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileLock retries with backoff and acquires when lock is released", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-retry-"));
  const targetFile = path.join(tmpDir, "data.json");

  const lock1 = new FileLock(targetFile, 5000);
  const lock2 = new FileLock(targetFile, 3000);

  await lock1.acquire();

  let lock2Acquired = false;
  const lock2Promise = lock2.acquire().then((res) => {
    lock2Acquired = res;
    return res;
  });

  // Hold lock for 120ms then release
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(lock2Acquired, false);
  lock1.release();

  const res = await lock2Promise;
  assert.equal(res, true);
  assert.equal(lock2Acquired, true);

  lock2.release();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FileLock stale lock recovery removes expired lock and acquires", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-stale-"));
  const targetFile = path.join(tmpDir, "data.json");
  const lockPath = `${targetFile}.lock`;

  // Write artificial stale lock file with older mtime
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: 999999, time: Date.now() - 60000 }),
    "utf-8"
  );
  const pastTime = (Date.now() - 60000) / 1000;
  fs.utimesSync(lockPath, pastTime, pastTime);

  // Create FileLock with staleAgeMs = 10000 (10s)
  const lock = new FileLock(targetFile, 3000, 10000);
  const acquired = await lock.acquire();

  assert.equal(acquired, true);
  assert.equal(fs.existsSync(lockPath), true);

  const content = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
  assert.equal(content.pid, process.pid);

  lock.release();
  assert.equal(fs.existsSync(lockPath), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("index.ts correctly re-exports FileLock", () => {
  assert.equal(typeof trmDevops.FileLock, "function");
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as TinyFishSkill from "../src/index.js";

describe("tinyfish-search exports", () => {
  test("exports required operations and types", () => {
    assert.equal(typeof TinyFishSkill.tinyfish_search, "function");
    assert.equal(typeof TinyFishSkill.tinyfish_extract, "function");
    assert.equal(typeof TinyFishSkill.TokenBucket, "function");
    assert.ok(TinyFishSkill.searchBucket instanceof TinyFishSkill.TokenBucket);
    assert.ok(TinyFishSkill.extractBucket instanceof TinyFishSkill.TokenBucket);
  });

  test("exports error constants", () => {
    assert.equal(typeof TinyFishSkill.ERR_MSG_RATE_LIMITED, "string");
    assert.equal(typeof TinyFishSkill.ERR_MSG_FAILED, "string");
    assert.equal(typeof TinyFishSkill.ERR_MSG_TIMEOUT, "string");
    assert.equal(typeof TinyFishSkill.ERR_MSG_API_KEY_MISSING, "string");
  });
});

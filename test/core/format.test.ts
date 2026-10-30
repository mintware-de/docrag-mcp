import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toErrorMessage, truncate } from "../../src/core/format.js";

describe("truncate", () => {
  it("leaves text at exactly max unchanged", () => {
    assert.equal(truncate("abc", 3), "abc");
  });

  it("shortens text longer than max and appends an ellipsis", () => {
    assert.equal(truncate("abcdef", 3), "abc...");
  });

  it("reduces to just the ellipsis at max 0", () => {
    assert.equal(truncate("abc", 0), "...");
  });
});

describe("toErrorMessage", () => {
  it("uses Error.message for Errors", () => {
    assert.equal(toErrorMessage(new Error("boom")), "boom");
  });

  it("stringifies non-Errors", () => {
    assert.equal(toErrorMessage("plain"), "plain");
    assert.equal(toErrorMessage(null), "null");
    assert.equal(toErrorMessage({}), "[object Object]");
  });
});

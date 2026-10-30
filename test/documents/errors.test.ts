import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DimensionMismatchError,
  Errors,
  FileNotFoundError,
  FileOutsideDocsError,
  NotMarkdownError,
} from "../../src/documents/errors.js";

describe("document errors", () => {
  it("NotMarkdownError carries the fixed message", () => {
    assert.equal(new NotMarkdownError().message, "Only .md files can be indexed.");
  });

  it("FileNotFoundError includes the path", () => {
    assert.equal(new FileNotFoundError("x/y.md").message, "File not found: x/y.md");
  });

  it("FileOutsideDocsError includes the configured docs dirs", () => {
    const err = new FileOutsideDocsError("/tmp/other.md", ["/home/u/docs", "/opt/d"]);
    assert.match(err.message, /outside the configured docs directories: \/tmp\/other\.md/);
    assert.match(err.message, /\/home\/u\/docs, \/opt\/d/);
  });

  it("FileOutsideDocsError reports (none) when no docs are configured", () => {
    assert.match(new FileOutsideDocsError("/tmp/x.md", []).message, /\(none\)/);
  });

  it("DimensionMismatchError reports the actual and expected dimensions", () => {
    const err = new DimensionMismatchError(1024, 768, "search");
    assert.match(err.message, /during search/);
    assert.match(err.message, /1024-dim/);
    assert.match(err.message, /768 dimensions/);
  });

  it("all errors are instanceof Errors (the MCP tool conversion contract)", () => {
    assert.ok(new NotMarkdownError() instanceof Errors);
    assert.ok(new FileNotFoundError("a.md") instanceof Errors);
    assert.ok(new FileOutsideDocsError("a.md", []) instanceof Errors);
    assert.ok(new DimensionMismatchError(1, 2, "x") instanceof Errors);
    assert.ok(new FileNotFoundError("a.md") instanceof Error);
  });

  it("Errors passes a custom message through", () => {
    assert.equal(new Errors("custom").message, "custom");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDeleteResult,
  formatDocumentList,
  formatIndexResult,
  formatSearchResults,
} from "../../src/mcp/formatters.js";
import type { DocumentStats, SearchResult } from "../../src/documents/document-service.js";

function result(path: string, content: string, score: number): SearchResult {
  return { chunk: { path, heading: "ignored by formatters", content, index: 0 }, score };
}

describe("formatSearchResults", () => {
  it("returns the empty message for no results", () => {
    assert.equal(formatSearchResults([]), "No matching documents found.");
  });

  it("formats a single result", () => {
    assert.equal(formatSearchResults([result("a.md", "body", 0.877)]), "=== a.md (score: 0.877) ===\nbody");
  });

  it("pads the score to three decimals", () => {
    assert.equal(formatSearchResults([result("a.md", "x", 1)]), "=== a.md (score: 1.000) ===\nx");
  });

  it("trims the chunk content", () => {
    assert.equal(formatSearchResults([result("a.md", "  padded  \n", 0.5)]), "=== a.md (score: 0.500) ===\npadded");
  });

  it("separates multiple results with a blank line and no trailing newline", () => {
    const out = formatSearchResults([result("a.md", "one", 0.5), result("b.md", "two", 0.25)]);
    assert.equal(out, "=== a.md (score: 0.500) ===\none\n\n=== b.md (score: 0.250) ===\ntwo");
  });
});

describe("formatDocumentList", () => {
  it("returns the empty message for no documents", () => {
    assert.equal(formatDocumentList([]), "No documents indexed.");
  });

  it("formats stats with an ISO timestamp", () => {
    const stats: DocumentStats[] = [
      { path: "a.md", chunkCount: 3, lastIndexed: new Date("2026-01-02T03:04:05.000Z") },
      { path: "sub/b.md", chunkCount: 1, lastIndexed: new Date("2026-01-02T03:04:06.000Z") },
    ];
    assert.equal(
      formatDocumentList(stats),
      "Indexed documents (2):\n\n" +
        "  a.md - 3 chunks - last indexed: 2026-01-02T03:04:05.000Z\n" +
        "  sub/b.md - 1 chunks - last indexed: 2026-01-02T03:04:06.000Z",
    );
  });
});

describe("formatIndexResult", () => {
  it("formats the indexed count", () => {
    assert.equal(formatIndexResult("a.md", 3), "Indexed 3 chunks from a.md.");
  });

  it("formats zero chunks", () => {
    assert.equal(formatIndexResult("empty.md", 0), "Indexed 0 chunks from empty.md.");
  });
});

describe("formatDeleteResult", () => {
  it("reports removed chunks", () => {
    assert.equal(formatDeleteResult("a.md", 3), "Removed 3 chunks from 'a.md'.");
  });

  it("reports not found when nothing was removed", () => {
    assert.equal(formatDeleteResult("a.md", 0), "Document 'a.md' not found.");
  });
});

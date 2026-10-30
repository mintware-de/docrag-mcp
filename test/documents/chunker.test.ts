import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Chunker } from "../../src/documents/chunker.js";

const chunker = new Chunker();

describe("Chunker.splitContent", () => {
  it("splits a single heading with body into one chunk", () => {
    const chunks = chunker.splitContent("a.md", "# Intro\nhello world\n");
    assert.deepEqual(chunks, [{ path: "a.md", heading: "Intro", content: "hello world", index: 0 }]);
  });

  it("splits multiple headings into consecutive chunks", () => {
    const chunks = chunker.splitContent("a.md", "# One\nfirst\n# Two\nsecond\n");
    assert.deepEqual(
      chunks.map((c) => [c.path, c.heading, c.content, c.index]),
      [
        ["a.md", "One", "first", 0],
        ["a.md", "Two", "second", 1],
      ],
    );
  });

  it("drops text before the first heading", () => {
    const chunks = chunker.splitContent("a.md", "preamble\nmore preamble\n# Real\nbody\n");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].heading, "Real");
    assert.equal(chunks[0].content, "body");
  });

  it("skips a heading with only-whitespace body and keeps indices consecutive", () => {
    const chunks = chunker.splitContent("a.md", "# Empty\n   \n# Filled\ncontent\n");
    assert.deepEqual(
      chunks.map((c) => [c.heading, c.index]),
      [["Filled", 0]],
    );
  });

  it("strips trailing whitespace but keeps interior newlines", () => {
    const chunks = chunker.splitContent("a.md", "# T\nline1\nline2  \n\n  ");
    assert.equal(chunks[0].content, "line1\nline2");
  });

  it("returns [] for empty content", () => {
    assert.deepEqual(chunker.splitContent("a.md", ""), []);
  });

  it("returns [] for heading-only content", () => {
    assert.deepEqual(chunker.splitContent("a.md", "# A\n# B\n"), []);
  });

  it("recognises heading levels 1 through 6", () => {
    for (let level = 1; level <= 6; level++) {
      const hashes = "#".repeat(level);
      const chunks = chunker.splitContent("a.md", `${hashes} H${level}\nbody\n`);
      assert.equal(chunks.length, 1, `level ${level}`);
      assert.equal(chunks[0].heading, `H${level}`);
    }
  });

  it("treats 7 hashes as body text, not a heading", () => {
    assert.deepEqual(chunker.splitContent("a.md", "####### seven\nbody\n"), []);
  });

  it("treats a missing space after the hashes as body text", () => {
    assert.deepEqual(chunker.splitContent("a.md", "##NoSpace\nbody\n"), []);
  });

  it("accepts a tab as heading separator", () => {
    const chunks = chunker.splitContent("a.md", "#\tTitle\nbody\n");
    assert.equal(chunks[0].heading, "Title");
  });

  it("trims surrounding whitespace from the heading text", () => {
    const chunks = chunker.splitContent("a.md", "##   Padded title   \nbody\n");
    assert.equal(chunks[0].heading, "Padded title");
  });

  it("does not strip closing ATX hashes", () => {
    const chunks = chunker.splitContent("a.md", "## Title ##\nbody\n");
    assert.equal(chunks[0].heading, "Title ##");
  });

  it("ignores a bare heading marker without text", () => {
    assert.deepEqual(chunker.splitContent("a.md", "# \nbody\n"), []);
  });

  it("ignores hash text that is not at line start", () => {
    assert.deepEqual(chunker.splitContent("a.md", "text # not-at-start\n"), []);
  });

  it("emits the final chunk at EOF even without a trailing newline", () => {
    const chunks = chunker.splitContent("a.md", "# A\nbody without newline");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, "body without newline");
  });

  it("passes filePath through verbatim to every chunk", () => {
    const chunks = chunker.splitContent("weird/../path.md", "# A\na\n# B\nb\n");
    assert.deepEqual(chunks.map((c) => c.path), ["weird/../path.md", "weird/../path.md"]);
  });

  it("handles CRLF line endings", () => {
    const chunks = chunker.splitContent("a.md", "## Title\r\nbody line\r\nsecond line\r\n");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].heading, "Title");
    assert.equal(chunks[0].content, "body line\nsecond line");
  });

  it("does not split on # lines inside a fenced code block", () => {
    const content =
      "# Setup\n" +
      "Install deps.\n" +
      "```python\n" +
      "# Configure\n" +
      "import x\n" +
      "```\n" +
      "# Usage\n" +
      "Use it.\n";
    const chunks = chunker.splitContent("a.md", content);
    assert.deepEqual(
      chunks.map((c) => c.heading),
      ["Setup", "Usage"],
    );
    assert.ok(chunks[0].content.includes("# Configure"), "code block comment must stay in Setup");
    assert.ok(chunks[0].content.includes("import x"));
  });

  it("supports tilde fences and only closes on matching marker", () => {
    const content =
      "# A\n" +
      "~~~\n" +
      "```not a close\n" +
      "# still code\n" +
      "~~~\n" +
      "# B\n" +
      "body\n";
    const chunks = chunker.splitContent("a.md", content);
    assert.deepEqual(
      chunks.map((c) => c.heading),
      ["A", "B"],
    );
  });
});

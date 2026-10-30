import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FileLogger } from "../../src/core/logger/file-logger.js";
import { withTempCwd } from "../helpers/tmp.js";

describe("FileLogger", () => {
  it("appends a timestamped level line to doc-rag.log", () => {
    withTempCwd(() => {
      new FileLogger().info("hello");
      const content = readFileSync(join(process.cwd(), "doc-rag.log"), "utf8");
      assert.match(content, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[INFO\] hello\n$/);
    });
  });

  it("appends multiple entries in call order", () => {
    withTempCwd(() => {
      const logger = new FileLogger();
      logger.info("first");
      logger.warn("second");
      const lines = readFileSync("doc-rag.log", "utf8").split("\n").filter(Boolean);
      assert.equal(lines.length, 2);
      assert.match(lines[0], /\[INFO\] first$/);
      assert.match(lines[1], /\[WARN\] second$/);
    });
  });

  it("honors a custom file name", () => {
    withTempCwd(() => {
      new FileLogger("custom.log").info("x");
      assert.equal(existsSync("custom.log"), true);
    });
  });

  it("writes all four levels by default", () => {
    withTempCwd(() => {
      const logger = new FileLogger();
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      const content = readFileSync("doc-rag.log", "utf8");
      for (const level of ["DEBUG", "INFO", "WARN", "ERROR"]) {
        assert.match(content, new RegExp(`\\[${level}\\] ${level.toLowerCase()}$`, "m"));
      }
    });
  });

  it("filters out levels below minLevel", () => {
    withTempCwd(() => {
      const logger = new FileLogger(undefined, "warn");
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");
      const content = readFileSync("doc-rag.log", "utf8");
      assert.ok(!content.includes("[DEBUG]"));
      assert.ok(!content.includes("[INFO]"));
      assert.match(content, /\[WARN\] w/);
      assert.match(content, /\[ERROR\] e/);
    });
  });

  it("swallows write errors", () => {
    withTempCwd(() => {
      mkdirSync("doc-rag.log");
      assert.doesNotThrow(() => new FileLogger().info("boom"));
    });
  });

  it("writes a parseable ISO timestamp", () => {
    withTempCwd(() => {
      new FileLogger().info("stamp");
      const match = readFileSync("doc-rag.log", "utf8").match(/^(\S+) \[INFO\]/);
      assert.ok(match);
      assert.ok(!Number.isNaN(new Date(match[1]).getTime()));
    });
  });
});

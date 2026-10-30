import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigLoader } from "../../src/core/config.js";
import { withTempCwd } from "../helpers/tmp.js";

describe("ConfigLoader.parse", () => {
  it("applies defaults and resolves relative paths against baseDir", () => {
    const cfg = ConfigLoader.parse({}, "/base");
    assert.equal(cfg.dbPath, join("/base", "docrag.db"));
    assert.deepEqual(cfg.docs, [join("/base", "docs")]);
  });

  it("leaves absolute paths untouched", () => {
    const cfg = ConfigLoader.parse({ dbPath: "/abs/db.sqlite", docs: ["/abs/docs"] }, "/base");
    assert.equal(cfg.dbPath, "/abs/db.sqlite");
    assert.deepEqual(cfg.docs, ["/abs/docs"]);
  });

  it("handles a mix of absolute and relative docs", () => {
    const cfg = ConfigLoader.parse({ docs: ["/abs/one", "rel/two"] }, "/base");
    assert.deepEqual(cfg.docs, ["/abs/one", join("/base", "rel/two")]);
  });

  it("does not mutate the raw input", () => {
    const raw = { dbPath: "db.sqlite", docs: ["docs"] };
    const snapshot = structuredClone(raw);
    ConfigLoader.parse(raw, "/base");
    assert.deepEqual(raw, snapshot);
  });

  it("keeps an explicit empty docs list", () => {
    const cfg = ConfigLoader.parse({ docs: [] }, "/base");
    assert.deepEqual(cfg.docs, []);
  });
});

describe("ConfigLoader.load", () => {
  it("loads and resolves docrag.config.json from the cwd", () => {
    withTempCwd(() => {
      writeFileSync(ConfigLoader.FILE_NAME, JSON.stringify({ dbPath: "custom.db" }));
      const cfg = ConfigLoader.load();
      assert.equal(cfg.dbPath, join(process.cwd(), "custom.db"));
      assert.equal(cfg.embeddingModel, "nomic-embed-text");
    });
  });

  it("throws a helpful error when the config file is missing", () => {
    withTempCwd(() => {
      assert.throws(
        () => ConfigLoader.load(),
        (err: Error) => {
          assert.match(err.message, /Could not find docrag\.config\.json/);
          assert.match(err.message, /CWD was:/);
          return true;
        },
      );
    });
  });
});

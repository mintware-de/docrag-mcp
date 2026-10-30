import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppConfigSchema } from "../../src/core/app-config.js";

describe("AppConfigSchema", () => {
  it("applies all defaults for an empty object", () => {
    const cfg = AppConfigSchema.decode({});
    assert.equal(cfg.dbPath, "./docrag.db");
    assert.deepEqual(cfg.docs, ["./docs"]);
    assert.equal(cfg.embeddingBaseUrl, "http://localhost:11434/v1");
    assert.equal(cfg.embeddingModel, "nomic-embed-text");
    assert.equal(cfg.embeddingDimensions, 768);
    assert.equal(cfg.logging, false);
    assert.equal(cfg.embeddingApiKey, undefined);
  });

  it("keeps embeddingApiKey optional", () => {
    assert.equal("embeddingApiKey" in AppConfigSchema.decode({}), false);
    assert.equal(AppConfigSchema.decode({ embeddingApiKey: "k" }).embeddingApiKey, "k");
  });

  it("respects partial overrides", () => {
    const cfg = AppConfigSchema.decode({ dbPath: "/tmp/x.db", embeddingDimensions: 1024, logging: true });
    assert.equal(cfg.dbPath, "/tmp/x.db");
    assert.equal(cfg.embeddingDimensions, 1024);
    assert.equal(cfg.logging, true);
    assert.equal(cfg.embeddingModel, "nomic-embed-text");
  });

  it("rejects an invalid embeddingBaseUrl", () => {
    assert.throws(() => AppConfigSchema.decode({ embeddingBaseUrl: "not a url" }));
  });

  it("rejects wrong value types", () => {
    assert.throws(() => AppConfigSchema.decode({ embeddingDimensions: "768" } as never));
    assert.throws(() => AppConfigSchema.decode({ docs: "./docs" } as never));
  });

  it("rejects non-positive or non-integer embeddingDimensions", () => {
    assert.throws(() => AppConfigSchema.decode({ embeddingDimensions: 0 }));
    assert.throws(() => AppConfigSchema.decode({ embeddingDimensions: -1 }));
    assert.throws(() => AppConfigSchema.decode({ embeddingDimensions: 1.5 }));
  });

  it("strips unknown keys", () => {
    const decoded = AppConfigSchema.decode({ bogus: 1 } as never);
    assert.equal("bogus" in decoded, false);
  });
});

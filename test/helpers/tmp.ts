import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function makeTempDir(prefix = "docrag-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = makeTempDir();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs fn with process.cwd() pointed at a fresh temp dir, then restores.
 * Sync-only: process.chdir across an await would leak into other tests in
 * the same file (which node:test runs sequentially per file).
 */
export function withTempCwd<T>(fn: () => T): T {
  const dir = makeTempDir();
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(prev);
    rmSync(dir, { recursive: true, force: true });
  }
}

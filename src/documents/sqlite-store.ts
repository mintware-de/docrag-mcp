import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";
import { load } from "sqlite-vec";
import { type Logger } from "../core/logger/logger.js";
import { SilentLogger } from "../core/logger/silent-logger.js";

export interface ChunkRow {
  id: string;
  path: string;
  heading: string;
  content: string;
  chunkIndex: number;
  contentHash: string;
  createdAtUnix: number;
}

export interface VectorRow {
  distance: number | null;
  path: string;
  heading: string | null;
  content: string;
  chunkIndex: number;
}

export interface StatsRow {
  path: string;
  chunkCount: number;
  lastIndexedUnix: number;
}

function toSqliteVector(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer);
}

/**
 * Pure SQLite/sqlite-vec data access layer: inserts, queries and deletes over
 * plain row DTOs. Callers supply complete rows (ids, hashes, timestamps);
 * no scoring, domain mapping or validation beyond what SQL requires.
 * Chunks live in chunks_data, embeddings in a vec0 virtual table.
 */
export class SqliteStore {
  private readonly db: Database.Database;
  private readonly dbPath: string;
  private readonly vectorDimensions: number;
  private readonly logger: Logger;

  constructor(dbPath: string, dimensions: number, logger: Logger = new SilentLogger()) {
    this.dbPath = dbPath;
    this.vectorDimensions = dimensions;
    this.logger = logger;
    const dir = path.dirname(dbPath);
    if (dir) fs.mkdirSync(dir, { recursive: true });

    // allowExtension exists at runtime but is missing from @types/better-sqlite3
    this.db = new Database(dbPath, { allowExtension: true } as unknown as Database.Options);
    load(this.db);
    logger.info(`SqliteStore created. DbPath=${dbPath}`);
  }

  get dimensions(): number {
    return this.vectorDimensions;
  }

  init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks_data (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        heading TEXT,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at_unix INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks_data(path);
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
        id TEXT PRIMARY KEY,
        embedding FLOAT[${this.vectorDimensions}] distance_metric=cosine
      );
    `);
    this.logger.info(`Database initialized at ${this.dbPath}.`);
  }

  insertChunks(rows: ChunkRow[], embeddings: number[][]): void {
    if (rows.length === 0) return;
    const insertData = this.db.prepare(
      `INSERT INTO chunks_data (id, path, heading, content, chunk_index, content_hash, created_at_unix)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertVec = this.db.prepare("INSERT INTO chunks_vec (id, embedding) VALUES (?, ?)");

    const tx = this.db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        insertData.run(r.id, r.path, r.heading, r.content, r.chunkIndex, r.contentHash, r.createdAtUnix);
        insertVec.run(r.id, toSqliteVector(embeddings[i]));
      }
    });
    tx();
  }

  deleteChunksByPath(filePath: string): number {
    return this.deleteChunksByPaths([filePath]);
  }

  deleteChunksByPaths(paths: readonly string[]): number {
    if (paths.length === 0) return 0;
    const placeholders = paths.map(() => "?").join(",");
    const tx = this.db.transaction(() => {
      const { c } = this.db
        .prepare(`SELECT COUNT(*) AS c FROM chunks_data WHERE path IN (${placeholders})`)
        .get(...paths) as { c: number };
      this.db
        .prepare(
          `DELETE FROM chunks_vec WHERE id IN (SELECT id FROM chunks_data WHERE path IN (${placeholders}))`,
        )
        .run(...paths);
      this.db.prepare(`DELETE FROM chunks_data WHERE path IN (${placeholders})`).run(...paths);
      return c;
    });
    return tx();
  }

  searchVectors(embedding: number[], k: number): VectorRow[] {
    const rows = this.db
      .prepare(
        `SELECT v.distance AS distance, d.path AS path, d.heading AS heading,
                d.content AS content, d.chunk_index AS chunk_index
         FROM chunks_vec v
         JOIN chunks_data d ON d.id = v.id
         WHERE v.embedding MATCH ? AND k = ?
         ORDER BY v.distance`,
      )
      .all(toSqliteVector(embedding), k) as {
      distance: number | null;
      path: string;
      heading: string | null;
      content: string;
      chunk_index: number;
    }[];

    return rows.map((r) => ({
      distance: r.distance,
      path: r.path,
      heading: r.heading,
      content: r.content,
      chunkIndex: r.chunk_index,
    }));
  }

  selectDocumentStats(): StatsRow[] {
    const rows = this.db
      .prepare(
        `SELECT path, COUNT(*) AS chunk_count, MAX(created_at_unix) AS last_indexed
         FROM chunks_data
         GROUP BY path
         ORDER BY path`,
      )
      .all() as { path: string; chunk_count: number; last_indexed: number }[];

    return rows.map((r) => ({
      path: r.path,
      chunkCount: r.chunk_count,
      lastIndexedUnix: r.last_indexed,
    }));
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
    this.logger.info("SqliteStore disposed.");
  }
}

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Chunker, type Chunk } from "./chunker.js";
import { Scanner } from "./scanner.js";
import type { Embedder } from "./embedder.js";
import type { ChunkRow, SqliteStore } from "./sqlite-store.js";
import { type Logger } from "../core/logger/logger.js";
import { truncate } from "../core/format.js";
import { DimensionMismatchError, FileNotFoundError, FileOutsideDocsError, NotMarkdownError } from "./errors.js";
import { SilentLogger } from "../core/logger/silent-logger.js";

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface DocumentStats {
  path: string;
  chunkCount: number;
  lastIndexed: Date;
}

export interface IndexFileResult {
  fileName: string;
  indexed: number;
}

export interface IndexDirectoryResult {
  chunks: number;
  files: number;
}

/**
 * Application layer: the use cases behind the CLI commands and the MCP
 * tools. Owns the business rules (ids, content hashes, timestamps,
 * validation, similarity scoring) and delegates raw SQL to SqliteStore.
 */
export class DocumentService {
  private readonly resolvedDocsDirs: readonly string[];

  constructor(
    private readonly store: SqliteStore,
    private readonly embedder: Embedder,
    docsDirs: readonly string[],
    private readonly logger: Logger = new SilentLogger(),
    private readonly chunker: Chunker = new Chunker(),
    private readonly scanner: Scanner = new Scanner(chunker),
  ) {
    this.resolvedDocsDirs = docsDirs.map((d) => path.resolve(d));
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    this.logger.info(`Search: query='${truncate(query, 80)}', limit=${limit}`);
    const queryEmbedding = await this.embedder.encode(query);
    this.assertDimensions(queryEmbedding.length, "search");

    const rows = this.store.searchVectors(queryEmbedding, limit);
    // sqlite-vec returns cosine distance in [0, 2]; map to similarity in [0, 1]
    // (clamped so opposite-direction vectors don't surface as negative scores).
    const results = rows.map((r) => ({
      chunk: {
        path: r.path,
        heading: r.heading ?? "",
        content: r.content,
        index: r.chunkIndex,
      },
      score: Math.max(0, 1.0 - (r.distance ?? 1.0)),
    }));

    this.logger.info(`Search returned ${results.length} results.`);
    return results;
  }

  listDocuments(): DocumentStats[] {
    const stats = this.store.selectDocumentStats().map((r) => ({
      path: r.path,
      chunkCount: r.chunkCount,
      lastIndexed: new Date(r.lastIndexedUnix * 1000),
    }));
    this.logger.debug(`Document stats: ${stats.length} files`);
    return stats;
  }

  /** Validates, reads, chunks, embeds and stores a single markdown file. */
  async indexFile(absolutePath: string): Promise<IndexFileResult> {
    if (path.extname(absolutePath).toLowerCase() !== ".md") {
      this.logger.warn(`indexFile rejected: not a .md file. ${absolutePath}`);
      throw new NotMarkdownError();
    }
    if (!fs.existsSync(absolutePath)) {
      this.logger.warn(`indexFile: file not found. ${absolutePath}`);
      throw new FileNotFoundError(absolutePath);
    }
    const docsDir = this.findContainingDocsDir(absolutePath);
    if (!docsDir) {
      this.logger.warn(`indexFile rejected: outside configured docs dirs. ${absolutePath}`);
      throw new FileOutsideDocsError(absolutePath, this.resolvedDocsDirs);
    }

    const relPath = path.relative(docsDir, absolutePath);
    const chunks = this.chunker.splitContent(relPath, fs.readFileSync(absolutePath, "utf8"));
    const indexed = await this.indexChunks(chunks);
    return { fileName: relPath, indexed };
  }

  private findContainingDocsDir(absolutePath: string): string | null {
    const resolved = path.resolve(absolutePath);
    for (const dir of this.resolvedDocsDirs) {
      const rel = path.relative(dir, resolved);
      if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return dir;
    }
    return null;
  }

  /** Chunks, embeds and stores every markdown file below a directory. */
  async indexDirectory(directory: string): Promise<IndexDirectoryResult> {
    const chunks = this.scanner.splitDirectory(directory);
    const files = new Set(chunks.map((c) => c.path)).size;
    const indexed = await this.indexChunks(chunks);
    return { chunks: indexed, files };
  }

  deleteDocument(filePath: string): number {
    this.logger.info(`Deleting chunks for path: ${filePath}`);
    const deleted = this.store.deleteChunksByPath(filePath);
    this.logger.info(`Deleted ${deleted} chunks for path: ${filePath}`);
    return deleted;
  }

  /**
   * Embeds the chunks and replaces all existing rows for the affected paths,
   * so re-indexing a file swaps its chunks instead of duplicating them.
   */
  private async indexChunks(chunks: Chunk[]): Promise<number> {
    if (chunks.length === 0) {
      this.logger.warn("No chunks to index.");
      return 0;
    }
    const embeddings = await this.embedder.encodeBatch(chunks.map((c) => c.content));
    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Expected ${chunks.length} embeddings for ${chunks.length} chunks, got ${embeddings.length}`,
      );
    }
    this.assertDimensions(embeddings[0].length, "index");

    this.logger.info(`Indexing ${chunks.length} chunks...`);
    const now = Math.floor(Date.now() / 1000);
    const rows: ChunkRow[] = chunks.map((c) => ({
      id: randomUUID().replaceAll("-", ""),
      path: c.path,
      heading: c.heading,
      content: c.content,
      chunkIndex: c.index,
      contentHash: createHash("sha256").update(c.content, "utf8").digest("hex"),
      createdAtUnix: now,
    }));
    const paths = [...new Set(chunks.map((c) => c.path))];

    this.store.transaction(() => {
      this.store.deleteChunksByPaths(paths);
      this.store.insertChunks(rows, embeddings);
    });

    this.logger.info(`Indexed ${chunks.length} chunks.`);
    return chunks.length;
  }

  private assertDimensions(actual: number, context: string): void {
    const expected = this.store.dimensions;
    if (actual !== expected) throw new DimensionMismatchError(actual, expected, context);
  }
}

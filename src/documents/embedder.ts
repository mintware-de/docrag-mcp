import { type Logger } from "../core/logger/logger.js";
import {SilentLogger} from "../core/logger/silent-logger.js";

/** Generates embeddings for texts. Implemented by OpenAIEmbedder; faked in tests. */
export interface Embedder {
  encode(text: string): Promise<number[]>;
  encodeBatch(texts: string[]): Promise<number[][]>;
}

export interface EmbedderOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  requestTimeoutMs?: number;
}

export interface EmbedderDeps {
  fetchImpl?: typeof fetch;
  logger?: Logger;
}

const BATCH_SIZE = 64;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

interface RawEmbeddingItem {
  index?: number;
  embedding?: number[];
}

/**
 * Validates one /embeddings response body and returns the embeddings in
 * input order. Pure — exported for tests.
 */
export function parseEmbeddingResponse(json: unknown, expectedCount: number): number[][] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data) || data.length !== expectedCount) {
    throw new Error(`Unexpected embed response shape (expected ${expectedCount} embeddings)`);
  }
  const ordered = [...(data as RawEmbeddingItem[])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return ordered.map((item) => {
    if (!Array.isArray(item.embedding)) {
      throw new Error("Embedding response contains a non-array embedding");
    }
    return item.embedding;
  });
}

/**
 * Generates text embeddings via the OpenAI-compatible /embeddings endpoint.
 * Works with any server exposing that API, e.g. Ollama (http://localhost:11434/v1)
 * or LM Studio (http://localhost:1234/v1).
 */
export class OpenAIEmbedder implements Embedder {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;

  constructor(options: EmbedderOptions, deps: EmbedderDeps = {}) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.logger = deps.logger ?? new SilentLogger();
    this.logger.info(`OpenAIEmbedder created. BaseUrl=${this.baseUrl}, Model=${this.model}`);
  }

  async encode(text: string): Promise<number[]> {
    return (await this.encodeBatch([text]))[0];
  }

  async encodeBatch(texts: string[]): Promise<number[][]> {
    this.logger.info(`Encoding batch of ${texts.length} texts (model=${this.model})...`);
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      results.push(...(await this.requestBatch(texts.slice(i, i + BATCH_SIZE))));
    }

    if (results.length > 0) {
      this.logger.debug(`Encoded ${results.length} texts, ${results[0].length} dimensions each`);
    }
    return results;
  }

  private async requestBatch(batch: string[]): Promise<number[][]> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.model, input: batch }),
        signal: controller.signal,
      });
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(`Embedding request timed out after ${this.requestTimeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
    }
    return parseEmbeddingResponse(await res.json(), batch.length);
  }
}

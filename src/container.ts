import { type Logger } from "./core/logger/logger.js";
import { OpenAIEmbedder, type Embedder } from "./documents/embedder.js";
import { SqliteStore } from "./documents/sqlite-store.js";
import { DocumentService } from "./documents/document-service.js";
import { Chunker } from "./documents/chunker.js";
import { Scanner } from "./documents/scanner.js";
import {SilentLogger} from "./core/logger/silent-logger.js";
import {FileLogger} from "./core/logger/file-logger.js";
import {AppConfig} from "./core/app-config.js";

export interface AppServices {
  embedder: Embedder;
  store: SqliteStore;
  documents: DocumentService;
}

/** Chooses the logger implementation from the config's `logging` flag. */
export function createLogger(config: AppConfig): Logger {
  return config.logging ? new FileLogger() : new SilentLogger();
}

/** Composition root: builds the object graph for a command from loaded config. */
export function createServices(config: AppConfig, logger: Logger): AppServices {
  const embedder = new OpenAIEmbedder(
    {
      baseUrl: config.embeddingBaseUrl,
      model: config.embeddingModel,
      apiKey: config.embeddingApiKey,
    },
    { logger },
  );
  const store = new SqliteStore(config.dbPath, config.embeddingDimensions, logger);
  store.init();
  const chunker = new Chunker();
  const scanner = new Scanner(chunker);
  const documents = new DocumentService(store, embedder, config.docs, logger, chunker, scanner);
  return { embedder, store, documents };
}

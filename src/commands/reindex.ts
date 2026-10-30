import { createServices } from "../container.js";

import {AppConfig} from "../core/app-config.js";
import type { Logger } from "../core/logger/logger.js";

/**
 * Rebuilds the vector index from markdown files in the configured directories.
 */
export async function runReindex(config: AppConfig, logger: Logger): Promise<void> {
  const { store, documents } = createServices(config, logger);
  logger.info(
    `Reindex starting. DbPath=${config.dbPath}, BaseUrl=${config.embeddingBaseUrl}, Model=${config.embeddingModel}`,
  );

  let totalChunks = 0;
  let totalFiles = 0;
  for (const dir of config.docs) {
    const { chunks, files } = await documents.indexDirectory(dir);
    totalChunks += chunks;
    totalFiles += files;
    logger.debug(`Scanned ${dir}: ${chunks} chunks in ${files} files`);
  }

  if (totalChunks === 0) {
    logger.warn(`No markdown files found to index. Scanned ${config.docs.length} dirs, 0 chunks`);
  } else {
    logger.info(`Reindex complete. Indexed ${totalChunks} chunks from ${totalFiles} files.`);
  }
  store.close();
}

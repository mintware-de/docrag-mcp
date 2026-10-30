#!/usr/bin/env node
import { ConfigLoader } from "./core/config.js";
import { createLogger } from "./container.js";
import { toErrorMessage } from "./core/format.js";
import { runInit } from "./commands/init.js";
import { runReindex } from "./commands/reindex.js";
import { runMcp } from "./commands/mcp.js";
import {AppConfig} from "./core/app-config.js";
import type { Logger } from "./core/logger/logger.js";

const VERSION = "0.1.0";

/**
 * CLI entry point. Supports three subcommands: init, reindex and mcp.
 * All configuration is read from docrag.config.json in the working directory.
 */
async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return 0;
  }

  const command = args[0].toLowerCase();

  // init creates the config file itself, so it must run before config loading.
  if (command === "init") {
    try {
      runInit();
      return 0;
    } catch (e) {
      console.error(`Error: ${toErrorMessage(e)}`);
      return 1;
    }
  }

  let config: AppConfig;
  try {
    config = ConfigLoader.load();
  } catch (e) {
    console.error(`Error: ${toErrorMessage(e)}`);
    return 1;
  }

  const commands: Record<string, (config: AppConfig, logger: Logger) => Promise<void>> = {
    reindex: runReindex,
    mcp: (c, l) => runMcp(c, l, VERSION),
  };
  const run = commands[command];
  if (!run) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }

  // Logging is opt-in via the config file; output goes to ./doc-rag.log, never stdout.
  const logger = createLogger(config);
  logger.info(`DocRAG starting. Executing command: ${command}`);

  try {
    await run(config, logger);
    logger.info(`Command completed successfully. Command=${command}`);
    return 0;
  } catch (e) {
    logger.error(`Unhandled error: ${e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)}`);
    console.error(`Error: ${toErrorMessage(e)}`);
    return 1;
  }
}

/** Prints usage information to standard error (stdout is reserved for MCP). */
function printHelp(): void {
  console.error("Usage: docrag-mcp <command>");
  console.error();
  console.error("Commands:");
  console.error("  init      Create docrag.config.json in the current directory");
  console.error("  reindex   Rebuild the vector index from markdown files");
  console.error("  mcp       Start the MCP server (stdio)");
  console.error();
  console.error("Configuration is read from docrag.config.json in the current directory.");
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(`Error: ${toErrorMessage(e)}`);
    process.exitCode = 1;
  });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServices } from "../container.js";
import { registerTools } from "../mcp/tools.js";
import {AppConfig} from "../core/app-config.js";
import type { Logger } from "../core/logger/logger.js";

/**
 * Starts the MCP server over stdio, exposing document search and management tools.
 */
export async function runMcp(config: AppConfig, logger: Logger, version: string): Promise<void> {
  const { documents } = createServices(config, logger);
  logger.info(`MCP server starting. DbPath=${config.dbPath}`);

  const server = new McpServer({ name: "docrag", version });
  registerTools(server, documents, logger);

  const closed = new Promise<void>((resolve) => {
    server.server.onclose = () => resolve();
  });

  await server.connect(new StdioServerTransport());
  logger.info("MCP server started. Listening on stdio.");

  await closed;
  logger.info("MCP server stopped.");
  // Intentionally no store.close() here: in-flight async tool handlers
  // (embedding fetch + SQLite query) could still be running when the client
  // hangs up, and the process exits right after anyway.
}

import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type DocumentService } from "../documents/document-service.js";
import { formatDeleteResult, formatDocumentList, formatIndexResult, formatSearchResults } from "./formatters.js";
import { toErrorMessage, truncate } from "../core/format.js";
import type { Logger } from "../core/logger/logger.js";
import {Errors} from "../documents/errors.js";

type ToolResult = { content: { type: "text"; text: string }[] };

function textResult(text: string): ToolResult {
  return { content: [{ type: "text" as const, text }] };
}

// Converts user-correctable Errors to a text result; lets unknown errors bubble.
async function asText(produce: () => Promise<string>): Promise<ToolResult> {
  try {
    return textResult(await produce());
  } catch (e) {
    if (e instanceof Errors) return textResult(`Error: ${toErrorMessage(e)}`);
    throw e;
  }
}

/**
 * Thin MCP transport layer: schemas and delegation to DocumentService.
 */
export function registerTools(server: McpServer, documents: DocumentService, logger: Logger): void {
  server.registerTool(
    "search",
    {
      description:
        "Search the document knowledge base using vector similarity. " +
        "Returns the most relevant document chunks for a query.",
      inputSchema: {
        query: z.string().describe("The search query text"),
        topK: z.number().int().positive().default(5).describe("Maximum number of results to return (default 5)"),
      },
    },
    ({ query, topK }) => asText(async () => {
      logger.info(`MCP tool Search: query='${truncate(query, 200)}', topK=${topK}`);
      return formatSearchResults(await documents.search(query, topK));
    }),
  );

  server.registerTool(
    "list_documents",
    {
      description:
        "Retrieve metadata for all indexed documents, " +
        "including filename, chunk count, and last indexed time.",
      inputSchema: {},
    },
    () => asText(async () => {
      logger.info("MCP tool ListDocuments");
      return formatDocumentList(documents.listDocuments());
    }),
  );

  server.registerTool(
    "index_markdown",
    {
      description:
        "Process and index a single markdown file for inclusion in the knowledge base. " +
        "Returns the number of chunks indexed.",
      inputSchema: {
        filePath: z.string().describe("Absolute path to the markdown file to index"),
      },
    },
    ({ filePath }) => asText(async () => {
      const safePath = path.resolve(filePath);
      logger.info(`MCP tool IndexMarkdown: ${safePath}`);
      const { fileName, indexed } = await documents.indexFile(safePath);
      logger.info(`MCP tool IndexMarkdown: indexed ${indexed} chunks`);
      return formatIndexResult(fileName, indexed);
    }),
  );

  server.registerTool(
    "delete_document",
    {
      description:
        "Remove a document from the knowledge base by its file path. " +
        "Returns the number of chunks removed.",
      inputSchema: {
        filename: z.string().describe("Relative path of the document to delete"),
      },
    },
    ({ filename }) => asText(async () => {
      logger.info(`MCP tool DeleteDocument: ${filename}`);
      return formatDeleteResult(filename, documents.deleteDocument(filename));
    }),
  );
}

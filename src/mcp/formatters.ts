import type {DocumentStats, SearchResult} from "../documents/document-service.js";

/**
 * Pure presentation for MCP tool results.
 */

export function formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) return "No matching documents found.";

    const blocks = results.map(
        ({chunk, score}) => `=== ${chunk.path} (score: ${score.toFixed(3)}) ===\n${chunk.content.trim()}\n`,
    );
    return blocks.join("\n").trimEnd();
}

export function formatDocumentList(stats: DocumentStats[]): string {
    if (stats.length === 0) return "No documents indexed.";

    const lines = stats.map(
        (s) => `  ${s.path} - ${s.chunkCount} chunks - last indexed: ${s.lastIndexed.toISOString()}`,
    );
    return `Indexed documents (${stats.length}):\n\n${lines.join("\n")}`;
}

export function formatIndexResult(fileName: string, indexed: number): string {
    return `Indexed ${indexed} chunks from ${fileName}.`;
}

export function formatDeleteResult(filename: string, removed: number): string {
    return removed > 0 ? `Removed ${removed} chunks from '${filename}'.` : `Document '${filename}' not found.`;
}



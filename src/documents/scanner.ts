import * as fs from "node:fs";
import * as path from "node:path";
import { Chunker, type Chunk } from "./chunker.js";

/**
 * Recursively scans a directory for *.md files and chunks each of them,
 * keyed by the path relative to the scan directory.
 */
export class Scanner {
  constructor(private readonly chunker: Chunker) {}

  splitDirectory(directory: string): Chunk[] {
    if (!directory || !fs.existsSync(directory)) return [];

    const chunks: Chunk[] = [];
    for (const file of this.findMarkdownFiles(directory)) {
      const content = fs.readFileSync(file, "utf8");
      chunks.push(...this.chunker.splitContent(path.relative(directory, file), content));
    }
    return chunks;
  }

  private findMarkdownFiles(directory: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...this.findMarkdownFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        found.push(full);
      }
    }
    return found;
  }
}

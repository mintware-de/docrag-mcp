export interface Chunk {
  path: string;
  heading: string;
  content: string;
  index: number;
}

/**
 * Splits markdown content into heading-bounded chunks: a chunk is emitted
 * only when the current heading is non-empty and the accumulated text
 * contains non-whitespace content. Lines inside fenced code blocks
 * (```/~~~) are treated as body, so `#` comments in code don't split.
 */
export class Chunker {
  splitContent(filePath: string, content: string): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = content.split(/\r?\n/);
    const buffer: string[] = [];
    let heading = "";
    let index = 0;
    let fence: string | null = null;

    for (const line of lines) {
      const fenceMarker = this.matchFence(line, fence);
      if (fenceMarker) {
        fence = fence ? null : fenceMarker;
        buffer.push(line);
        continue;
      }
      const isHeading = fence === null && /^(#{1,6})\s+(.+)$/.exec(line);
      if (isHeading) {
        if (this.emit(chunks, filePath, heading, buffer, index)) index++;
        heading = isHeading[2].trim();
        buffer.length = 0;
      } else {
        buffer.push(line);
      }
    }
    this.emit(chunks, filePath, heading, buffer, index);

    return chunks;
  }

  // Returns the fence character ("`" or "~") when the line opens or closes a
  // fenced code block, else null. A closing fence must use the same character
  // as the opener.
  private matchFence(line: string, open: string | null): string | null {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (!m) return null;
    const marker = m[1][0];
    if (open !== null && marker !== open) return null;
    return marker;
  }

  private emit(chunks: Chunk[], filePath: string, heading: string, buffer: string[], index: number): boolean {
    if (buffer.length === 0 || heading === "") return false;
    const text = buffer.join("\n").replace(/\s+$/, "");
    if (text.trim() === "") return false;
    chunks.push({ path: filePath, heading, content: text, index });
    return true;
  }
}

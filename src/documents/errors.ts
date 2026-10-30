/** Error raised by DocumentService for user-correctable input problems. */
export class Errors extends Error {
}

export class NotMarkdownError extends Errors {
    constructor() {
        super("Only .md files can be indexed.");
    }
}

export class FileNotFoundError extends Errors {
    constructor(filePath: string) {
        super(`File not found: ${filePath}`);
    }
}

export class FileOutsideDocsError extends Errors {
    constructor(filePath: string, docsDirs: readonly string[]) {
        super(
            `File is outside the configured docs directories: ${filePath}. ` +
            `Configured docs: ${docsDirs.length === 0 ? "(none)" : docsDirs.join(", ")}.`,
        );
    }
}

export class DimensionMismatchError extends Errors {
    constructor(actual: number, expected: number, context: string) {
        super(
            `Embedding dimension mismatch during ${context}: model returns ${actual}-dim vectors, ` +
            `but the database was created with ${expected} dimensions. ` +
            `Set "embeddingDimensions": ${actual} in docrag.config.json and delete the database file, ` +
            `or use a model with ${expected}-dim embeddings.`,
        );
    }
}

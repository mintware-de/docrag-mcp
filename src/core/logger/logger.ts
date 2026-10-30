/**
 * Logging abstraction. Components receive a Logger via injection; nothing
 * writes to stdout, because in MCP mode stdout carries JSON-RPC frames.
 */
export interface Logger {
    debug(message: string): void;

    info(message: string): void;

    warn(message: string): void;

    error(message: string): void;
}

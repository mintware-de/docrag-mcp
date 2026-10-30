import fs from "node:fs";
import path from "node:path";
import {Logger} from "./logger.js";

const LEVELS = {debug: 0, info: 1, warn: 2, error: 3} as const;

/**
 * File logger appending to `fileName` in the working directory.
 * Logging must never crash the process, so open/write errors are swallowed.
 * The file is opened once on first write and the fd reused for the process
 * lifetime; the kernel closes it on exit.
 */
export class FileLogger implements Logger {
    private fd: number | null = null;
    private broken = false;

    constructor(
        private readonly fileName = "doc-rag.log",
        private readonly minLevel: keyof typeof LEVELS = "debug",
    ) {
    }

    debug(message: string): void {
        this.write("debug", message);
    }

    info(message: string): void {
        this.write("info", message);
    }

    warn(message: string): void {
        this.write("warn", message);
    }

    error(message: string): void {
        this.write("error", message);
    }

    private write(level: keyof typeof LEVELS, message: string): void {
        if (LEVELS[level] < LEVELS[this.minLevel]) return;
        if (this.broken) return;
        if (this.fd === null) {
            try {
                this.fd = fs.openSync(path.join(process.cwd(), this.fileName), "a");
            } catch {
                this.broken = true;
                return;
            }
        }
        try {
            fs.writeSync(this.fd, `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`);
        } catch {
            // logging must never crash the process
        }
    }
}
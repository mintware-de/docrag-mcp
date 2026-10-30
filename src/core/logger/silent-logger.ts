import {Logger} from "./logger.js";

export class SilentLogger implements Logger {
    debug(): void {
    }

    info(): void {
    }

    warn(): void {
    }

    error(): void {
    }
}
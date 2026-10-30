/** Small shared formatting helpers used by the logger and the presentation layer. */


/** Shortens text to `max` characters, appending an ellipsis when cut. */
export function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function toErrorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

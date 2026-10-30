import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigLoader } from "../core/config.js";
import {AppConfigSchema} from "../core/app-config.js";

/**
 * Creates docrag.config.json with default values in the current working
 * directory. Fails if the file already exists. Output goes to stderr;
 * stdout is reserved for MCP.
 */
export function runInit(): void {
  const target = path.join(process.cwd(), ConfigLoader.FILE_NAME);

  if (fs.existsSync(target)) {
    throw new Error(`${ConfigLoader.FILE_NAME} already exists at ${target}`);
  }

  const defaults = AppConfigSchema.decode({});
  fs.writeFileSync(target, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
  console.error(`Created ${target}`);
}

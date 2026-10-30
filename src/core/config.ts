import * as fs from "node:fs";
import * as path from "node:path";
import {AppConfig, AppConfigSchema, RawConfig} from "./app-config.js";

export class ConfigLoader {
    static readonly FILE_NAME = "docrag.config.json";

    /** Applies defaults and resolves relative paths against the config's directory. Pure. */
    static parse(raw: RawConfig, baseDir: string): AppConfig {
        const resolve = (p: string): string => (path.isAbsolute(p) ? p : path.resolve(baseDir, p));
        const validated = AppConfigSchema.decode(raw);
        validated.dbPath = resolve(validated.dbPath);
        validated.docs = validated.docs.map(resolve);

        return validated;
    }

    /** Loads docrag.config.json from the current working directory. */
    static load(): AppConfig {
        const configPath = path.join(process.cwd(), ConfigLoader.FILE_NAME);
        if (!fs.existsSync(configPath)) {
            throw new Error(
                `Could not find ${ConfigLoader.FILE_NAME} in the current directory. CWD was: ${process.cwd()}`,
            );
        }
        return ConfigLoader.parse(JSON.parse(fs.readFileSync(configPath, "utf8")) as RawConfig, process.cwd());
    }
}

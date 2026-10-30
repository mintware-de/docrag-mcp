import {z} from "zod";

export const AppConfigSchema = z.object({
    dbPath: z.string().default("./docrag.db"),
    docs: z.array(z.string()).default(["./docs"]),
    embeddingBaseUrl: z.url().default("http://localhost:11434/v1"),
    embeddingApiKey: z.string().optional(),
    embeddingModel: z.string().default("nomic-embed-text"),
    embeddingDimensions: z.number().int().positive().default(768),
    logging: z.boolean().default(false),
})

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type RawConfig = z.input<typeof AppConfigSchema>;

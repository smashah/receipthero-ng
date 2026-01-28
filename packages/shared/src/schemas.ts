import { z } from "zod";

// Zod schema for application configuration
export const ConfigSchema = z.object({
  paperless: z.object({
    host: z.string().url("PAPERLESS_HOST must be a valid URL"),
    apiKey: z.string().min(1, "PAPERLESS_API_KEY is required"),
  }),
  togetherAi: z.object({
    apiKey: z.string().min(1, "TOGETHER_API_KEY is required"),
  }),
  processing: z.object({
    scanInterval: z.number().positive().default(300000),
    receiptTag: z.string().default("receipt"),
    processedTag: z.string().default("ai-processed"),
    failedTag: z.string().default("ai-failed"),
    maxRetries: z.number().int().positive().default(3),
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    upstashUrl: z.string().optional(),
    upstashToken: z.string().optional(),
  }).optional().default({ enabled: false }),
  observability: z.object({
    heliconeEnabled: z.boolean().default(false),
    heliconeApiKey: z.string().optional(),
  }).optional().default({ heliconeEnabled: false }),
});

export type Config = z.infer<typeof ConfigSchema>;

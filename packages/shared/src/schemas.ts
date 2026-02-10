import { z } from "zod";

// AI provider enum
export const AIProviderSchema = z.enum(['openai-compat', 'ollama', 'openrouter']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

// Zod schema for application configuration
export const ConfigSchema = z.object({
  paperless: z.object({
    host: z.string().url("PAPERLESS_HOST must be a valid URL"),
    apiKey: z.string().min(1, "PAPERLESS_API_KEY is required"),
  }),
  ai: z.object({
    provider: AIProviderSchema.default('openai-compat'),
    apiKey: z.string().optional(),
    baseURL: z.string().url().optional(),
    model: z.string().default('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
  }),
  // Kept for backward compatibility — resolved in config.ts
  togetherAi: z.object({
    apiKey: z.string().min(1),
  }).optional(),
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

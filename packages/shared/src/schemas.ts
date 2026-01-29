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
    skippedTag: z.string().default("ai-skipped"),
    maxRetries: z.number().int().positive().default(3),
    retryStrategy: z.enum(['full', 'partial']).default('partial'),
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

// ─────────────────────────────────────────────────────────────────────────────
// Partial Config Schema for PATCH semantics
// All fields are optional - API will merge with existing config
// ─────────────────────────────────────────────────────────────────────────────

export const PartialConfigSchema = z.object({
  paperless: z.object({
    host: z.string().url("PAPERLESS_HOST must be a valid URL").optional(),
    apiKey: z.string().min(1, "PAPERLESS_API_KEY is required").optional(),
  }).optional(),
  togetherAi: z.object({
    apiKey: z.string().min(1, "TOGETHER_API_KEY is required").optional(),
  }).optional(),
  processing: z.object({
    scanInterval: z.number().positive().optional(),
    receiptTag: z.string().optional(),
    processedTag: z.string().optional(),
    failedTag: z.string().optional(),
    skippedTag: z.string().optional(),
    maxRetries: z.number().int().positive().optional(),
    retryStrategy: z.enum(['full', 'partial']).optional(),
  }).optional(),
  rateLimit: z.object({
    enabled: z.boolean().optional(),
    upstashUrl: z.string().optional(),
    upstashToken: z.string().optional(),
  }).optional(),
  observability: z.object({
    heliconeEnabled: z.boolean().optional(),
    heliconeApiKey: z.string().optional(),
  }).optional(),
});

export type PartialConfig = z.infer<typeof PartialConfigSchema>;

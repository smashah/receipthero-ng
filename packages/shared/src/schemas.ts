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
    skippedTag: z.string().default("ai-skipped"),
    maxRetries: z.number().int().positive().default(3),
    retryStrategy: z.enum(['full', 'partial']).default('partial'),
    // Document detection mode
    useDocumentType: z.boolean().default(false),  // Use document_type instead of tag for detection
    documentTypeName: z.string().default('receipt'), // Name of document type to filter by
    // Feature toggles
    updateContent: z.boolean().default(true),    // Normalize and update document content
    addJsonPayload: z.boolean().default(true),   // Add receipt JSON as custom field
    autoTag: z.boolean().default(true),          // Auto-add suggested tags from AI
    // Currency conversion settings
    currencyConversion: z.object({
      enabled: z.boolean().default(false),
      targetCurrencies: z.array(z.string()).default(['GBP', 'USD']),
    }).optional().default({ enabled: false, targetCurrencies: ['GBP', 'USD'] }),
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
    useDocumentType: z.boolean().optional(),
    documentTypeName: z.string().optional(),
    updateContent: z.boolean().optional(),
    addJsonPayload: z.boolean().optional(),
    autoTag: z.boolean().optional(),
    currencyConversion: z.object({
      enabled: z.boolean().optional(),
      targetCurrencies: z.array(z.string()).optional(),
    }).optional(),
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

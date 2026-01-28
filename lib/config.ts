import { z } from "zod";
import * as fs from "fs";

// Configuration file path
const CONFIG_FILE_PATH = "/app/data/config.json";

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
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Loads configuration from file and environment variables.
 * 
 * Priority order:
 * 1. /app/data/config.json values (if file exists and has the key)
 * 2. Environment variable values (if config file doesn't have the key)
 * 3. Default values (from Zod schema)
 * 
 * @throws Error if required fields are missing or validation fails
 */
export function loadConfig(): Config {
  let fileConfig: Partial<Record<string, unknown>> = {};

  // Try to read config file
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      fileConfig = JSON.parse(fileContent);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file ${CONFIG_FILE_PATH}: ${error.message}`);
    }
    // If file doesn't exist or can't be read, continue with env vars only
    console.warn(`Could not read config file: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Build configuration object from file + env vars
  const rawConfig = {
    paperless: {
      host: getConfigValue(fileConfig, ["paperless", "host"], process.env.PAPERLESS_HOST),
      apiKey: getConfigValue(fileConfig, ["paperless", "apiKey"], process.env.PAPERLESS_API_KEY),
    },
    togetherAi: {
      apiKey: getConfigValue(fileConfig, ["togetherAi", "apiKey"], process.env.TOGETHER_API_KEY),
    },
    processing: {
      scanInterval: getConfigValueNumber(
        fileConfig,
        ["processing", "scanInterval"],
        process.env.SCAN_INTERVAL ? parseInt(process.env.SCAN_INTERVAL, 10) : undefined
      ),
      receiptTag: getConfigValue(fileConfig, ["processing", "receiptTag"], process.env.RECEIPT_TAG),
      processedTag: getConfigValue(fileConfig, ["processing", "processedTag"], process.env.PROCESSED_TAG),
      failedTag: getConfigValue(fileConfig, ["processing", "failedTag"], process.env.FAILED_TAG),
      maxRetries: getConfigValueNumber(
        fileConfig,
        ["processing", "maxRetries"],
        process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES, 10) : undefined
      ),
    },
  };

  // Validate with Zod schema
  const result = ConfigSchema.safeParse(rawConfig);
  
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Gets a string value from the config file, falling back to env var value.
 */
function getConfigValue(
  fileConfig: Partial<Record<string, unknown>>,
  path: string[],
  envValue: string | undefined
): string | undefined {
  const fileValue = getNestedValue(fileConfig, path);
  if (typeof fileValue === "string" && fileValue.length > 0) {
    return fileValue;
  }
  return envValue;
}

/**
 * Gets a number value from the config file, falling back to env var value.
 */
function getConfigValueNumber(
  fileConfig: Partial<Record<string, unknown>>,
  path: string[],
  envValue: number | undefined
): number | undefined {
  const fileValue = getNestedValue(fileConfig, path);
  if (typeof fileValue === "number" && !isNaN(fileValue)) {
    return fileValue;
  }
  return envValue;
}

/**
 * Gets a nested value from an object using a path array.
 */
function getNestedValue(
  obj: Partial<Record<string, unknown>>,
  path: string[]
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// Export config file path for use by other modules
export const CONFIG_PATH = CONFIG_FILE_PATH;

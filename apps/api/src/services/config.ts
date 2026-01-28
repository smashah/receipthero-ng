import { ConfigSchema, type Config } from '@sm-rn/shared/schemas';
import * as fs from 'fs';

// Configuration file path
export const CONFIG_PATH = process.env.CONFIG_PATH || '/app/data/config.json';

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
    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(fileContent);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file ${CONFIG_PATH}: ${error.message}`);
    }
    // If file doesn't exist or can't be read, continue with env vars only
    console.warn(`Could not read config file: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Build configuration object from file + env vars
  const rawConfig = {
    paperless: {
      host: getConfigValue(fileConfig, ['paperless', 'host'], process.env.PAPERLESS_HOST),
      apiKey: getConfigValue(fileConfig, ['paperless', 'apiKey'], process.env.PAPERLESS_API_KEY),
    },
    togetherAi: {
      apiKey: getConfigValue(fileConfig, ['togetherAi', 'apiKey'], process.env.TOGETHER_API_KEY),
    },
    processing: {
      scanInterval: getConfigValueNumber(
        fileConfig,
        ['processing', 'scanInterval'],
        process.env.SCAN_INTERVAL ? parseInt(process.env.SCAN_INTERVAL, 10) : undefined
      ),
      receiptTag: getConfigValue(fileConfig, ['processing', 'receiptTag'], process.env.RECEIPT_TAG),
      processedTag: getConfigValue(fileConfig, ['processing', 'processedTag'], process.env.PROCESSED_TAG),
      failedTag: getConfigValue(fileConfig, ['processing', 'failedTag'], process.env.FAILED_TAG),
      maxRetries: getConfigValueNumber(
        fileConfig,
        ['processing', 'maxRetries'],
        process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES, 10) : undefined
      ),
    },
    rateLimit: {
      enabled: getConfigValueBoolean(
        fileConfig,
        ['rateLimit', 'enabled'],
        process.env.RATE_LIMIT_ENABLED === 'true'
      ),
      upstashUrl: getConfigValue(fileConfig, ['rateLimit', 'upstashUrl'], process.env.UPSTASH_URL),
      upstashToken: getConfigValue(fileConfig, ['rateLimit', 'upstashToken'], process.env.UPSTASH_TOKEN),
    },
    observability: {
      heliconeEnabled: getConfigValueBoolean(
        fileConfig,
        ['observability', 'heliconeEnabled'],
        process.env.HELICONE_ENABLED === 'true'
      ),
      heliconeApiKey: getConfigValue(fileConfig, ['observability', 'heliconeApiKey'], process.env.HELICONE_API_KEY),
    },
  };

  // Validate with Zod schema
  const result = ConfigSchema.safeParse(rawConfig);
  
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
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
  if (typeof fileValue === 'string' && fileValue.length > 0) {
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
  if (typeof fileValue === 'number' && !isNaN(fileValue)) {
    return fileValue;
  }
  return envValue;
}

/**
 * Gets a boolean value from the config file, falling back to env var value.
 */
function getConfigValueBoolean(
  fileConfig: Partial<Record<string, unknown>>,
  path: string[],
  envValue: boolean | undefined
): boolean | undefined {
  const fileValue = getNestedValue(fileConfig, path);
  if (typeof fileValue === 'boolean') {
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
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

import { ConfigSchema, type Config } from '@sm-rn/shared/schemas';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger';

const logger = createLogger('config');

// Configuration file path
export const CONFIG_PATH = process.env.CONFIG_PATH || '/app/data/config.json';

/**
 * Returns a default config template with placeholder values.
 */
function getDefaultConfigTemplate(): Record<string, unknown> {
  return {
    paperless: {
      host: 'http://localhost:8000',
      apiKey: 'YOUR_PAPERLESS_API_KEY',
    },
    togetherAi: {
      apiKey: 'YOUR_TOGETHER_AI_API_KEY',
    },
    processing: {
      scanInterval: 60000,
      receiptTag: 'receipt',
      processedTag: 'receipt-processed',
      failedTag: 'receipt-failed',
      skippedTag: 'receipt-skipped',
      maxRetries: 3,
      updateContent: true,
      addJsonPayload: true,
      autoTag: true,
      currencyConversion: {
        enabled: false,
        targetCurrencies: ['GBP', 'USD'],
      },
    },
    rateLimit: {
      enabled: false,
      upstashUrl: '',
      upstashToken: '',
    },
    observability: {
      heliconeEnabled: false,
      heliconeApiKey: '',
    },
  };
}

/**
 * Creates a default config file if it doesn't exist.
 * Returns true if a new file was created, false if file already existed.
 */
function ensureConfigFileExists(): boolean {
  if (fs.existsSync(CONFIG_PATH)) {
    return false;
  }

  try {
    // Ensure the directory exists
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write default config
    const defaultConfig = getDefaultConfigTemplate();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');

    logger.lifecycle('📝', `Created default config file at ${CONFIG_PATH}`);
    logger.warn('Please update the placeholder values (especially API keys) before running again.');
    return true;
  } catch (error) {
    logger.warn(`Could not create default config file: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Loads configuration from file and environment variables.
 * 
 * Priority order:
 * 1. /app/data/config.json values (if file exists and has the key)
 * 2. Environment variable values (if config file doesn't have the key)
 * 3. Default values (from Zod schema)
 * 
 * If no config file exists, a default template will be created.
 * 
 * @throws Error if required fields are missing or validation fails
 */
export function loadConfig(): Config {
  // Ensure config file exists (creates default if missing)
  const wasCreated = ensureConfigFileExists();

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
    logger.warn(`Could not read config file: ${error instanceof Error ? error.message : String(error)}`);
  }

  // If we just created a fresh config with placeholder values, log a warning
  if (wasCreated) {
    logger.warn(
      `A default config file was created at ${CONFIG_PATH}. ` +
      `Please update the placeholder API keys: paperless.apiKey, togetherAi.apiKey`
    );
  }

  // Build configuration object from file + env vars
  const rawConfig = {
    paperless: {
      host: getConfigValue(fileConfig, ['paperless', 'host'], process.env.PAPERLESS_HOST),
      apiKey: getConfigValue(fileConfig, ['paperless', 'apiKey'], process.env.PAPERLESS_API_KEY),
    },
    ai: {
      provider: getConfigValue(fileConfig, ['ai', 'provider'], process.env.AI_PROVIDER),
      apiKey: getConfigValue(fileConfig, ['ai', 'apiKey'], process.env.AI_API_KEY),
      baseURL: getConfigValue(fileConfig, ['ai', 'baseURL'], process.env.AI_BASE_URL),
      model: getConfigValue(fileConfig, ['ai', 'model'], process.env.AI_MODEL),
    },
    togetherAi: getConfigValue(fileConfig, ['togetherAi', 'apiKey'], process.env.TOGETHER_API_KEY)
      ? { apiKey: getConfigValue(fileConfig, ['togetherAi', 'apiKey'], process.env.TOGETHER_API_KEY)! }
      : undefined,
    processing: {
      scanInterval: getConfigValueNumber(
        fileConfig,
        ['processing', 'scanInterval'],
        process.env.SCAN_INTERVAL ? parseInt(process.env.SCAN_INTERVAL, 10) : undefined
      ),
      receiptTag: getConfigValue(fileConfig, ['processing', 'receiptTag'], process.env.RECEIPT_TAG),
      processedTag: getConfigValue(fileConfig, ['processing', 'processedTag'], process.env.PROCESSED_TAG),
      failedTag: getConfigValue(fileConfig, ['processing', 'failedTag'], process.env.FAILED_TAG),
      skippedTag: getConfigValue(fileConfig, ['processing', 'skippedTag'], process.env.SKIPPED_TAG),
      maxRetries: getConfigValueNumber(
        fileConfig,
        ['processing', 'maxRetries'],
        process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES, 10) : undefined
      ),
      updateContent: getConfigValueBoolean(
        fileConfig,
        ['processing', 'updateContent'],
        process.env.UPDATE_CONTENT === 'true' ? true : process.env.UPDATE_CONTENT === 'false' ? false : undefined
      ),
      addJsonPayload: getConfigValueBoolean(
        fileConfig,
        ['processing', 'addJsonPayload'],
        process.env.ADD_JSON_PAYLOAD === 'true' ? true : process.env.ADD_JSON_PAYLOAD === 'false' ? false : undefined
      ),
      autoTag: getConfigValueBoolean(
        fileConfig,
        ['processing', 'autoTag'],
        process.env.AUTO_TAG === 'true' ? true : process.env.AUTO_TAG === 'false' ? false : undefined
      ),
      currencyConversion: getConfigValueObject(
        fileConfig,
        ['processing', 'currencyConversion'],
        undefined
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

  // Backward compatibility: migrate togetherAi.apiKey → ai.apiKey
  if (!result.data.ai.apiKey && result.data.togetherAi?.apiKey) {
    result.data.ai.apiKey = result.data.togetherAi.apiKey;
    if (!result.data.ai.baseURL) {
      result.data.ai.baseURL = 'https://api.together.xyz/v1';
    }
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
 * Gets an object value from the config file, falling back to env var value.
 */
function getConfigValueObject<T>(
  fileConfig: Partial<Record<string, unknown>>,
  path: string[],
  envValue: T | undefined
): T | undefined {
  const fileValue = getNestedValue(fileConfig, path);
  if (typeof fileValue === 'object' && fileValue !== null) {
    return fileValue as T;
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

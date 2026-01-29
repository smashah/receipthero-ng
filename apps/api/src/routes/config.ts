import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ConfigSchema, PartialConfigSchema } from '@sm-rn/shared/schemas';
import { loadConfig, CONFIG_PATH } from '@sm-rn/core';
import * as fs from 'fs';
import * as path from 'path';

const config = new Hono();

// Helper to mask API keys
function maskApiKey(key: string | undefined): string {
  if (!key || key.length < 8) return key || '';
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

// Helper for deep merge (handles nested objects)
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

// GET /api/config - Return current config with masked keys
config.get('/', (c) => {
  try {
    const cfg = loadConfig();
    
    // Mask sensitive data
    const masked = {
      ...cfg,
      paperless: {
        ...cfg.paperless,
        apiKey: maskApiKey(cfg.paperless.apiKey),
      },
      togetherAi: {
        apiKey: maskApiKey(cfg.togetherAi.apiKey),
      },
      rateLimit: cfg.rateLimit ? {
        ...cfg.rateLimit,
        upstashToken: maskApiKey(cfg.rateLimit.upstashToken),
      } : undefined,
      observability: cfg.observability ? {
        ...cfg.observability,
        heliconeApiKey: maskApiKey(cfg.observability.heliconeApiKey),
      } : undefined,
    };

    return c.json(masked);
  } catch (error) {
    return c.json(
      { 
        success: false,
        error: {
          name: 'ServerError',
          message: error instanceof Error ? error.message : String(error)
        }
      },
      500
    );
  }
});

// PATCH /api/config - Save configuration (PATCH semantics)
config.patch('/', zValidator('json', PartialConfigSchema), async (c) => {
  try {
    const partialConfig = c.req.valid('json');

    // Load existing config
    let existingConfig;
    try {
      existingConfig = loadConfig();
    } catch {
      // No existing config - need full config for first-time setup
      const parseResult = ConfigSchema.safeParse(partialConfig);
      if (!parseResult.success) {
        return c.json(
          { 
            success: false, 
            error: {
              name: 'ValidationError',
              message: 'First-time setup requires all required fields',
              issues: parseResult.error.issues
            }
          },
          400
        );
      }
      existingConfig = parseResult.data;
    }

    // Deep merge partial config with existing
    const mergedConfig = deepMerge(existingConfig, partialConfig);

    // Validate the merged result
    const parseResult = ConfigSchema.safeParse(mergedConfig);
    if (!parseResult.success) {
      return c.json(
        { 
          success: false, 
          error: {
            name: 'ValidationError',
            message: 'Invalid configuration after merge',
            issues: parseResult.error.issues
          }
        },
        400
      );
    }

    // Ensure directory exists
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write config file
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(parseResult.data, null, 2), 'utf-8');

    return c.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    return c.json(
      { 
        success: false,
        error: { 
          name: 'ServerError',
          message: error instanceof Error ? error.message : String(error) 
        }
      },
      500
    );
  }
});

export default config;

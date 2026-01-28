import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ConfigSchema } from '@sm-rn/shared/schemas';
import { loadConfig, CONFIG_PATH } from '../services/config';
import * as fs from 'fs';
import * as path from 'path';

const config = new Hono();

// Helper to mask API keys
function maskApiKey(key: string | undefined): string {
  if (!key || key.length < 8) return key || '';
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
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
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

// POST /api/config - Save configuration
config.post('/', zValidator('json', ConfigSchema), async (c) => {
  try {
    const newConfig = c.req.valid('json');

    // Ensure directory exists
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write config file
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

    return c.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

export default config;

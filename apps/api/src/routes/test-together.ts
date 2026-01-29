import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { loadConfig, createLogger } from '@sm-rn/core';

const logger = createLogger('api');
const testTogether = new Hono();

const TestTogetherSchema = z.object({
  apiKey: z.string().min(1),
});

testTogether.post('/', zValidator('json', TestTogetherSchema), async (c) => {
  let { apiKey } = c.req.valid('json');

  // Handle masked API key
  if (apiKey.includes('...')) {
    try {
      const config = loadConfig();
      if (config.togetherAi?.apiKey) {
        apiKey = config.togetherAi.apiKey;
      }
    } catch (error) {
      logger.warn('Failed to load existing config for masked key', error);
    }
  }

  // Basic validation - check format
  if (apiKey.length < 20) {
    return c.json(
      {
        success: false,
        error: 'API key appears to be too short',
      },
      400
    );
  }

  return c.json({
    success: true,
    message: 'Together AI API key format looks valid',
  });
});

export default testTogether;

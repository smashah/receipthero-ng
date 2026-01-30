import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PaperlessClient, loadConfig, createLogger } from '@sm-rn/core';

const logger = createLogger('paperless');
const testPaperless = new Hono();

const TestPaperlessSchema = z.object({
  host: z.string().url(),
  apiKey: z.string().min(1),
});

testPaperless.post('/', zValidator('json', TestPaperlessSchema), async (c) => {
  let { host, apiKey } = c.req.valid('json');
  // Handle masked API key
  if (apiKey.includes('...')) {
    try {
      const config = loadConfig();
      if (config.paperless?.apiKey) {
        apiKey = config.paperless.apiKey;
      }
    } catch (error) {
      logger.warn('Failed to load existing config for masked key', error);
    }
  }

  logger.debug(`Testing connection to ${host} with key ${apiKey}`);
  try {
    const client = new PaperlessClient({
      host,
      apiKey,
      processedTagName: 'ai-processed',
    });

    await client.getTags();

    return c.json({
      success: true,
      message: 'Successfully connected to Paperless-NGX',
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      400
    );
  }
});

export default testPaperless;

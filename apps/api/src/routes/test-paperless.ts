import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PaperlessClient } from '../services/paperless';

const testPaperless = new Hono();

const TestPaperlessSchema = z.object({
  host: z.string().url(),
  apiKey: z.string().min(1),
});

testPaperless.post('/', zValidator('json', TestPaperlessSchema), async (c) => {
  const { host, apiKey } = c.req.valid('json');

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

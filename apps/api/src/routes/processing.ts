import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { 
  loadConfig, 
  PaperlessClient, 
  processPaperlessDocument, 
  createTogetherClient,
  RetryQueue,
  createLogger
} from '@sm-rn/core';

const logger = createLogger('api');
const processing = new Hono();

const RetrySchema = z.object({
  strategy: z.enum(['full', 'partial']).default('partial'),
});

// POST /api/processing/:id/retry - Trigger a manual retry
processing.post('/:id/retry', zValidator('json', RetrySchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const { strategy } = c.req.valid('json');

  try {
    const config = loadConfig();
    const client = new PaperlessClient({
      host: config.paperless.host,
      apiKey: config.paperless.apiKey,
      processedTagName: config.processing.processedTag,
    });
    const togetherClient = createTogetherClient(config);
    const retryQueue = new RetryQueue(config.processing.maxRetries);

    // Run processing in background
    processPaperlessDocument(
      client, 
      id, 
      togetherClient, 
      retryQueue, 
      config.processing.failedTag,
      strategy
    ).catch(err => {
      logger.error(`Background retry for document ${id} failed`, err);
    });

    return c.json({ success: true, message: `Retry triggered using ${strategy} strategy` });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

export default processing;

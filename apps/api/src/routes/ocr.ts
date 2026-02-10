import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { extractReceiptData, createAIAdapter, loadConfig, createLogger } from '@sm-rn/core';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const logger = createLogger('ocr');
const ocr = new Hono();

const OcrRequestSchema = z.object({
  base64Image: z.string().min(1),
});

ocr.post('/', zValidator('json', OcrRequestSchema), async (c) => {
  const { base64Image } = c.req.valid('json');

  try {
    // Load config
    const config = loadConfig();

    // Apply rate limiting if enabled
    if (config.rateLimit?.enabled && config.rateLimit.upstashUrl && config.rateLimit.upstashToken) {
      const ratelimit = new Ratelimit({
        redis: new Redis({
          url: config.rateLimit.upstashUrl,
          token: config.rateLimit.upstashToken,
        }),
        limiter: Ratelimit.slidingWindow(10, '1 m'),
      });

      const identifier = c.req.header('x-forwarded-for') || 'anonymous';
      const { success } = await ratelimit.limit(identifier);

      if (!success) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    }

    // Create AI adapter
    const adapter = createAIAdapter(config);

    // Extract receipt data
    const receipts = await extractReceiptData(base64Image, adapter);

    return c.json({ receipts });
  } catch (error) {
    logger.error('OCR extraction failed', error);
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

export default ocr;

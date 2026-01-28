import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const testTogether = new Hono();

const TestTogetherSchema = z.object({
  apiKey: z.string().min(1),
});

testTogether.post('/', zValidator('json', TestTogetherSchema), async (c) => {
  const { apiKey } = c.req.valid('json');

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

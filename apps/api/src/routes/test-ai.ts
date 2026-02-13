import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AIProviderSchema } from '@sm-rn/shared/schemas';
import { testAIConnection } from '@sm-rn/core';

const testAi = new Hono();

const TestAiSchema = z.object({
  provider: AIProviderSchema.default('openai-compat'),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  model: z.string().default('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
});

testAi.post('/', zValidator('json', TestAiSchema), async (c) => {
  const { provider, apiKey, baseURL, model } = c.req.valid('json');

  const result = await testAIConnection({ provider, apiKey, baseURL, model });

  if (!result.success) {
    const status = result.error?.includes('required') ? 400 : 500;
    return c.json(result, status);
  }

  return c.json(result);
});

export default testAi;

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { chat } from '@tanstack/ai';
import type { AnyTextAdapter } from '@tanstack/ai';
import { AIProviderSchema } from '@sm-rn/shared/schemas';
import { createOpenaiChat } from '@tanstack/ai-openai';
import { createOllamaChat } from '@tanstack/ai-ollama';

const testAi = new Hono();

const TestAiSchema = z.object({
  provider: AIProviderSchema.default('openai-compat'),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  model: z.string().default('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
});

testAi.post('/', zValidator('json', TestAiSchema), async (c) => {
  const { provider, apiKey, baseURL, model } = c.req.valid('json');

  try {
    // Create temporary adapter from provided config
    let adapter: AnyTextAdapter;
    switch (provider) {
      case 'openai-compat': {
        if (!apiKey) {
          return c.json({ success: false, error: 'API key is required for openai-compat provider' }, 400);
        }
        adapter = createOpenaiChat(model as never, apiKey, {
          baseURL: baseURL || 'https://api.together.xyz/v1',
        }) as unknown as AnyTextAdapter;
        break;
      }
      case 'ollama': {
        adapter = createOllamaChat(model as never, baseURL || 'http://localhost:11434') as unknown as AnyTextAdapter;
        break;
      }
      case 'openrouter': {
        if (!apiKey) {
          return c.json({ success: false, error: 'API key is required for openrouter provider' }, 400);
        }
        // OpenRouter is OpenAI-compatible
        adapter = createOpenaiChat(model as never, apiKey, {
          baseURL: baseURL || 'https://openrouter.ai/api/v1',
        }) as unknown as AnyTextAdapter;
        break;
      }
      default:
        return c.json({ success: false, error: `Unknown provider: ${provider}` }, 400);
    }

    // Send a simple test message
    const response = await chat({
      adapter,
      messages: [
        {
          role: 'user' as const,
          content: 'Say hello in 5 words or less.',
        },
      ],
      stream: false as const,
    });

    return c.json({
      success: true,
      response,
      provider,
      model,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default testAi;

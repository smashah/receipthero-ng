
import { createOpenaiChat } from '@tanstack/ai-openai';
import { createOllamaChat } from '@tanstack/ai-ollama';
import { chat } from '@tanstack/ai';
import type { AnyTextAdapter } from '@tanstack/ai';
import type { Config } from '@sm-rn/shared/schemas';

const APP_NAME_HELICONE = 'receipthero';

/** The adapter type returned by createAIAdapter */
export type AIAdapter = AnyTextAdapter;

/** Options for testing an AI connection */
export interface TestAIConnectionOptions {
  provider: 'openai-compat' | 'ollama' | 'openrouter';
  apiKey?: string;
  baseURL?: string;
  model: string;
}

/** Result of testing an AI connection */
export interface TestAIConnectionResult {
  success: boolean;
  response?: string;
  provider: string;
  model: string;
  error?: string;
}

/**
 * Tests an AI provider connection by sending a simple chat message.
 * Creates a temporary adapter from the provided config and validates connectivity.
 */
export async function testAIConnection(options: TestAIConnectionOptions): Promise<TestAIConnectionResult> {
  const { provider, apiKey, baseURL, model } = options;

  try {
    let adapter: AIAdapter;
    switch (provider) {
      case 'openai-compat': {
        if (!apiKey) {
          return { success: false, error: 'API key is required for openai-compat provider', provider, model };
        }
        adapter = createOpenaiChat(model as never, apiKey, {
          baseURL: baseURL || 'https://api.together.xyz/v1',
        }) as unknown as AIAdapter;
        break;
      }
      case 'ollama': {
        adapter = createOllamaChat(model as never, baseURL || 'http://localhost:11434') as unknown as AIAdapter;
        break;
      }
      case 'openrouter': {
        if (!apiKey) {
          return { success: false, error: 'API key is required for openrouter provider', provider, model };
        }
        adapter = createOpenaiChat(model as never, apiKey, {
          baseURL: baseURL || 'https://openrouter.ai/api/v1',
        }) as unknown as AIAdapter;
        break;
      }
      default:
        return { success: false, error: `Unknown provider: ${provider}`, provider, model };
    }

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

    return {
      success: true,
      response: response as unknown as string,
      provider,
      model,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      provider,
      model,
    };
  }
}

/**
 * Creates a TanStack AI text adapter based on the configured provider.
 * Supports OpenAI-compatible APIs (Together AI, vLLM, OpenRouter, etc.) and Ollama.
 *
 * OpenRouter is handled via openai-compat since its API is OpenAI-compatible.
 */
export function createAIAdapter(config: Config): AIAdapter {
  const { ai, observability } = config;

  switch (ai.provider) {
    case 'openai-compat': {
      if (!ai.apiKey) {
        throw new Error('AI API key is required for openai-compat provider. Set AI_API_KEY or TOGETHER_API_KEY.');
      }

      let baseURL = ai.baseURL || 'https://api.together.xyz/v1';
      const headers: Record<string, string> = {};

      // Helicone observability proxy
      if (observability?.heliconeEnabled && observability.heliconeApiKey) {
        baseURL = 'https://together.helicone.ai/v1';
        headers['Helicone-Auth'] = `Bearer ${observability.heliconeApiKey}`;
        headers['Helicone-Property-Appname'] = APP_NAME_HELICONE;
      }

      // Cast model to satisfy the literal union type — users pass arbitrary model names for custom endpoints
      // The returned adapter is structurally compatible with AnyTextAdapter
      return createOpenaiChat(ai.model as never, ai.apiKey, {
        baseURL,
        defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
      }) as unknown as AIAdapter;
    }

    case 'ollama': {
      const host = ai.baseURL || 'http://localhost:11434';
      return createOllamaChat(ai.model as never, host) as unknown as AIAdapter;
    }

    case 'openrouter': {
      if (!ai.apiKey) {
        throw new Error('AI API key is required for openrouter provider. Set AI_API_KEY.');
      }
      // OpenRouter is OpenAI-compatible — use the OpenAI adapter with OpenRouter's base URL
      return createOpenaiChat(ai.model as never, ai.apiKey, {
        baseURL: ai.baseURL || 'https://openrouter.ai/api/v1',
      }) as unknown as AIAdapter;
    }

    default:
      throw new Error(`Unknown AI provider: ${ai.provider}`);
  }
}

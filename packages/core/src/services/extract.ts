import type { Config } from '@sm-rn/shared/schemas';

export interface ExtractionContext {
  existingTags?: string[];
}

/** Derive the chat completions base URL and API key from config. */
function resolveEndpoint(config: Config): { baseURL: string; apiKey: string; model: string } {
  const { ai } = config;
  switch (ai.provider) {
    case 'openai-compat':
      if (!ai.apiKey) throw new Error('AI API key is required for openai-compat provider.');
      return {
        baseURL: ai.baseURL || 'https://api.together.xyz/v1',
        apiKey: ai.apiKey,
        model: ai.model,
      };
    case 'openrouter':
      if (!ai.apiKey) throw new Error('AI API key is required for openrouter provider.');
      return {
        baseURL: ai.baseURL || 'https://openrouter.ai/api/v1',
        apiKey: ai.apiKey,
        model: ai.model,
      };
    case 'ollama':
      // Ollama's OpenAI-compat endpoint lives at /v1 on the Ollama host
      return {
        baseURL: `${ai.baseURL || 'http://localhost:11434'}/v1`,
        apiKey: 'ollama',
        model: ai.model,
      };
    default:
      throw new Error(`Unknown AI provider: ${(ai as any).provider}`);
  }
}

/**
 * Wraps the user's item schema in a top-level `items` array wrapper, which is required
 * because response_format/json_schema must describe a single root object (not an array).
 */
function buildResponseSchema(itemSchema: any): any {
  // Strip $schema (Zod v4 emits 2020-12) — providers may reject unknown meta-schema keys
  const { $schema: _ignored, ...cleanItemSchema } = itemSchema;
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: cleanItemSchema,
        description: 'One entry per logical item found in the document.',
      },
    },
    required: ['items'],
    additionalProperties: false,
  };
}

/**
 * Generic extraction engine that uses a JSON Schema to extract structured data from an image.
 *
 * Uses `response_format: { type: "json_schema" }` on the /v1/chat/completions endpoint —
 * this is the proper structured outputs API supported by all OpenAI-compatible providers
 * (Together AI, OpenRouter, Ollama, etc.). No text parsing or regex cleaning is performed;
 * the provider guarantees the response matches the schema.
 *
 * NOTE: We deliberately bypass the @tanstack/ai-openai adapter because, as of v0.5.0, it
 * still routes all calls through client.responses.create() (the Responses API), which is
 * only supported by OpenAI itself and not by OpenAI-compatible providers.
 */
export async function extractWithSchema(
  base64Image: string,
  jsonSchema: any,
  promptInstructions: string | undefined,
  config: Config,
  context?: ExtractionContext
): Promise<Record<string, unknown>[]> {
  const existingTagsSection = context?.existingTags?.length
    ? `\n\nEXISTING DOCUMENT TAGS:\nThe document already has these tags: [${context.existingTags.join(', ')}]\nDo not repeat them; suggest complementary ones only.`
    : '';

  const systemPrompt = [
    'You are a structured data extraction engine.',
    'Extract data from the provided image according to the JSON schema defined in the response format.',
    'Populate the `items` array — one entry per logical item found in the document.',
    'Dates MUST be in YYYY-MM-DD format.',
    'If information is not visible, use reasonable defaults or omit optional fields.',
    promptInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${promptInstructions}` : '',
    existingTagsSection,
  ]
    .filter(Boolean)
    .join('\n');

  const { baseURL, apiKey, model } = resolveEndpoint(config);
  const responseSchema = buildResponseSchema(jsonSchema);

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'extraction_result',
          strict: true,
          schema: responseSchema,
        },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all data from this image.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI provider returned ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  const rawContent = json.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('AI provider returned an empty response.');
  }

  // The provider guarantees this is valid JSON matching the schema — no cleaning needed.
  const parsed = JSON.parse(rawContent) as { items: Record<string, unknown>[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

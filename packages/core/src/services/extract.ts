import Ajv from 'ajv';
import type { Config } from '@sm-rn/shared/schemas';

const ajv = new Ajv({ coerceTypes: true });

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
      throw new Error(`Unknown AI provider: ${ai.provider}`);
  }
}

/**
 * Generic extraction engine that uses a JSON Schema to extract structured data from an image.
 *
 * Uses plain fetch to POST /v1/chat/completions directly — this is the ONLY reliable way to
 * avoid the `/v1/responses` endpoint that openai@6 routes all adapter calls through by default.
 * That endpoint is unsupported by Together AI, OpenRouter, Ollama, and every other compat provider.
 */
export async function extractWithSchema(
  base64Image: string,
  jsonSchema: any,
  promptInstructions: string | undefined,
  config: Config,
  context?: ExtractionContext
): Promise<Record<string, unknown>[]> {
  const existingTagsSection = context?.existingTags?.length
    ? `\n\nEXISTING DOCUMENT TAGS:\nThe document already has these tags: [${context.existingTags.join(', ')}]\nConsider these when suggesting additional tags - don't repeat them, but suggest complementary ones.`
    : '';

  const schemaStr = JSON.stringify(jsonSchema, null, 2);

  const systemPrompt = [
    'You are a structured data extraction engine.',
    'Extract data from the provided image and return ONLY a valid JSON object — no markdown, no explanation, no code fences.',
    '',
    'The JSON must follow this exact structure:',
    '{ "items": [ <one object per logical item found, matching the schema below> ] }',
    '',
    'SCHEMA FOR EACH ITEM:',
    schemaStr,
    '',
    'CRITICAL REQUIREMENTS:',
    '- Dates MUST be in YYYY-MM-DD format.',
    '- Respond ONLY with the raw JSON object. No markdown. No ```json fences.',
    '- If information is not visible, use reasonable defaults or omit optional fields.',
    promptInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${promptInstructions}` : '',
    existingTagsSection,
  ]
    .filter(Boolean)
    .join('\n');

  const { baseURL, apiKey, model } = resolveEndpoint(config);

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all data from this image. Return only the JSON object.' },
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
  const rawText = json.choices?.[0]?.message?.content ?? '';

  // Strip markdown fences if the model added them anyway
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: { items?: unknown[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Some models wrap the JSON in extra text — try to extract the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Model did not return valid JSON. Raw response: ${rawText.slice(0, 500)}`);
    parsed = JSON.parse(match[0]);
  }

  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  // Validate each item against the original JSON Schema
  // Strip $schema (Zod v4 emits 2020-12) — Ajv defaults to Draft 7 and rejects it
  const { $schema: _ignored, ...ajvSchema } = jsonSchema;
  const validate = ajv.compile(ajvSchema);
  for (const item of items) {
    const isValid = validate(item);
    if (!isValid) {
      console.warn('Extracted item failed Ajv validation against JSON Schema:', validate.errors);
    }
  }

  return items as Record<string, unknown>[];
}

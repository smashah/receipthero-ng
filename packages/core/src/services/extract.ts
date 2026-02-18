import { z } from 'zod';
import Ajv from 'ajv';
import type { AIAdapter } from './ai-client';
import { chat } from '@tanstack/ai';

const ajv = new Ajv();

export interface ExtractionContext {
  existingTags?: string[];
}

/**
 * Generic extraction engine that uses a JSON Schema to extract structured data from an image.
 */
export async function extractWithSchema(
  base64Image: string,
  jsonSchema: any,
  promptInstructions: string | undefined,
  adapter: AIAdapter,
  context?: ExtractionContext
): Promise<Record<string, unknown>[]> {
  // Build context section for existing tags
  const existingTagsSection = context?.existingTags?.length
    ? `\n\nEXISTING DOCUMENT TAGS:\nThe document already has these tags: [${context.existingTags.join(', ')}]\nConsider these when suggesting additional tags - don't repeat them, but suggest complementary ones.`
    : '';

  const basePrompt = `Extract structured data from this document image. Return a JSON object matching the provided schema.
  
CRITICAL REQUIREMENTS:
- Dates MUST be in YYYY-MM-DD format.
- Respond ONLY with valid JSON matching the schema.
- If information is not visible, use reasonable defaults or omit if not applicable.`;

  const systemPrompt = `${basePrompt}${promptInstructions ? `\n\nADDITIONAL INSTRUCTIONS:\n${promptInstructions}` : ''}${existingTagsSection}`;

  // We wrap the user's schema in an object with an array of items
  // This matches the Together AI / Llama 4 Maverick pattern for multiple extractions
  // and maintains compatibility with ReceiptHero's internal expectations.
  const wrappedSchema = z.object({
    items: z.array(z.fromJSONSchema(jsonSchema) as any),
  });

  const result = await chat({
    adapter,
    systemPrompts: [systemPrompt],
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            content: 'Extract data from this image following the schema and instructions.',
          },
          {
            type: 'image' as const,
            source: { type: 'data' as const, value: base64Image, mimeType: 'image/jpeg' as const },
          },
        ],
      },
    ],
    outputSchema: wrappedSchema,
  });

  // Validate the items against the original JSON Schema using Ajv as a secondary check
  // (TanStack AI already validates against the Zod schema generated from JSON Schema)
  const validate = ajv.compile(jsonSchema);
  const items = result.items || [];

  for (const item of items) {
    const isValid = validate(item);
    if (!isValid) {
      console.warn('Extracted item failed Ajv validation against original JSON Schema:', validate.errors);
      // We still return it since Zod already validated it, but we log the warning
    }
  }

  return items as Record<string, unknown>[];
}

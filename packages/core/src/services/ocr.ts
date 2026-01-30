import { z } from 'zod';
import { ProcessedReceiptSchema } from '@sm-rn/shared/types';
import type { Together } from 'together-ai';

export const ReceiptExtractionSchema = z.object({
  receipts: z.array(ProcessedReceiptSchema),
});

export interface ExtractionContext {
  existingTags?: string[];
}

export async function extractReceiptData(
  base64Image: string,
  togetherClient: Together,
  context?: ExtractionContext
) {
  const jsonSchema = z.toJSONSchema(ReceiptExtractionSchema);

  // Build context section for existing tags
  const existingTagsSection = context?.existingTags?.length
    ? `\n\nEXISTING DOCUMENT TAGS:\nThe document already has these tags: [${context.existingTags.join(', ')}]\nConsider these when suggesting additional tags - don't repeat them, but suggest complementary ones.`
    : '';

  const response = await togetherClient.chat.completions.create({
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    messages: [
      {
        role: 'system',
        content: `You are an expert at extracting receipt data. Extract all receipts from the image as a JSON object matching the schema.

CRITICAL FORMATTING REQUIREMENTS:
- Date MUST be in YYYY-MM-DD format (e.g., "2024-01-15", not "01/15/2024" or "Jan 15, 2024")
- Convert any date format to YYYY-MM-DD
- If date is ambiguous, use the most recent logical date

CURRENCY EXTRACTION:
- ALWAYS include a currency field in the response
- Extract the currency code (e.g., "USD", "EUR", "AED", "GBP", "CAD", etc.) from currency symbols or explicit mentions
- Common currency symbols: $ = USD, € = EUR, £ = GBP, AED = AED (or د.إ), etc.
- If no currency symbol is visible on the receipt, use "USD" as the default
- Currency field should be the 3-letter currency code (ISO 4217 format)

TITLE GENERATION:
- Generate a concise, descriptive title for the receipt/document
- Format: "[Vendor Name] - [Main Purchase Type] - [Date]"
- Examples: "Apple Store - MacBook Pro Purchase - 2024-01-15", "Starbucks - Coffee - 2024-03-20", "Shell - Fuel - 2024-02-10"
- Keep it under 100 characters

SUMMARY GENERATION:
- Write a 2-4 sentence human-readable summary of the receipt
- Include: vendor name, date, total amount with currency, what was purchased (item names if visible), and payment method
- Make it conversational and easy to scan
- Example: "Coffee purchase from Starbucks on January 15, 2024. Total: $5.75 USD. Items: Grande Latte. Paid by credit card."

LINE ITEMS:
- Extract individual line items from the receipt if visible
- For each item include: name (required), quantity (if shown), unitPrice (if shown), totalPrice (required)
- If items aren't clearly visible or the receipt just shows a total, you can omit this field
- Examples: [{"name": "Grande Latte", "quantity": 1, "unitPrice": 5.75, "totalPrice": 5.75}]

SUGGESTED TAGS:
- Generate 2-5 relevant tags that describe what this receipt is for
- Tags should be lowercase, single words or hyphenated phrases
- Consider: vendor type, purchase type, location, payment method, etc.
- Examples: "fuel", "coffee", "groceries", "electronics", "hotel", "restaurant", "office-supplies"
- Be specific - prefer "fuel" over "gas-station", prefer "coffee" over "food"

CATEGORIZATION RULES:
- Grocery stores (Walmart, Target, Kroger, Safeway, Whole Foods, Trader Joe's, Costco, Sam's Club, Aldi, Publix, Wegmans): "groceries"
- Restaurants/Fast food (McDonald's, Starbucks, Chipotle, Taco Bell, Subway, etc.): "dining"
- Gas stations (Shell, Exxon, Chevron, BP, Speedway, etc.): "gas"
- Pharmacies (CVS, Walgreens, Rite Aid, etc.): "healthcare"
- Department stores (Macy's, Kohl's, JCPenney, etc.): "shopping"
- Electronics (Best Buy, Apple Store, etc.): "electronics"
- Home improvement (Home Depot, Lowe's, etc.): "home"
- Clothing (Gap, Old Navy, H&M, etc.): "clothing"
- Online services (Amazon, eBay, etc.): "shopping"
- Utilities (electric, gas, water, internet): "utilities"
- Entertainment (movies, concerts, etc.): "entertainment"
- Travel (hotels, airlines, etc.): "travel"
- Other: Use your best judgment to categorize appropriately

PAYMENT METHODS: Common values include "cash", "credit", "debit", "check", "gift card", "digital wallet"
${existingTagsSection}
Extract all visible receipt data accurately. If information is not visible, use reasonable defaults or omit if not applicable. Respond only with valid JSON.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract receipt data from this image following the formatting and categorization rules.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
    response_format: { type: 'json_object', schema: jsonSchema },
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OCR extraction failed: empty response');
  }

  const parsedJson = JSON.parse(content);
  const validated = ReceiptExtractionSchema.safeParse(parsedJson);

  if (!validated.success) {
    throw new Error(`Validation failed: ${validated.error.message}`);
  }

  return validated.data.receipts;
}


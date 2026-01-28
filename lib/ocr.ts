import { togetheraiClient } from "@/lib/client";
import { z } from "zod";
import { ProcessedReceiptSchema } from "@/lib/types";

export const ReceiptExtractionSchema = z.object({
  receipts: z.array(ProcessedReceiptSchema),
});

export async function extractReceiptData(base64Image: string) {
  const jsonSchema = z.toJSONSchema(ReceiptExtractionSchema);

  const response = await togetheraiClient.chat.completions.create({
    model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    messages: [
      {
        role: "system",
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

Extract all visible receipt data accurately. If information is not visible, use reasonable defaults or omit if not applicable. Respond only with valid JSON.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract receipt data from this image following the formatting and categorization rules.",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object", schema: jsonSchema },
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OCR extraction failed: empty response");
  }

  const parsedJson = JSON.parse(content);
  const validated = ReceiptExtractionSchema.safeParse(parsedJson);
  
  if (!validated.success) {
    throw new Error(`Validation failed: ${validated.error.message}`);
  }

  return validated.data.receipts;
}

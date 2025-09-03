import { NextResponse } from "next/server";
import { togetheraiClient } from "@/lib/client";
import { z } from "zod";
import { ProcessedReceiptSchema } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { base64Image } = await request.json();

    if (!base64Image || typeof base64Image !== "string") {
      return NextResponse.json(
        { error: "Missing required field: base64Image" },
        { status: 400 }
      );
    }

    const receiptSchema = z.object({
      receipts: z.array(ProcessedReceiptSchema),
    });
    const jsonSchema = z.toJSONSchema(receiptSchema);

    const response = await togetheraiClient.chat.completions.create({
      model: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at extracting receipt data. Extract all receipts from the image as a JSON object matching the schema. Each receipt should include date, vendor, category, paymentMethod, taxAmount, and amount. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract receipt data from this image.",
            },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      response_format: { type: "json_object", schema: jsonSchema },
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "OCR extraction failed: empty response" },
        { status: 502 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON from model" },
        { status: 502 }
      );
    }

    const validated = receiptSchema.safeParse(parsedJson);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.message },
        { status: 422 }
      );
    }

    return NextResponse.json({ receipts: validated.data.receipts });
  } catch (error) {
    console.error("/api/ocr error", error);
    return NextResponse.json(
      { error: "Internal error while performing OCR" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { togetheraiClient } from "@/lib/client";

export async function POST(request: Request) {
  try {
    const { base64Image } = await request.json();

    if (!base64Image || typeof base64Image !== "string") {
      return NextResponse.json(
        { error: "Missing required field: base64Image" },
        { status: 400 }
      );
    }

    const response = await togetheraiClient.chat.completions.create({
      model: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at extracting text from receipts. Extract the full text content with high fidelity. Respond only with the extracted text, without any additional comments, introductions, or explanations.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all visible text from this receipt.",
            },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "OCR extraction failed: empty response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: content });
  } catch (error) {
    console.error("/api/ocr error", error);
    return NextResponse.json(
      { error: "Internal error while performing OCR" },
      { status: 500 }
    );
  }
}

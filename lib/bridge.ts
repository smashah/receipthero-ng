import { PaperlessClient } from "./paperless";
import { extractReceiptData } from "./ocr";

export async function processPaperlessDocument(
  client: PaperlessClient,
  documentId: number
) {
  console.log(`Processing document ${documentId}...`);
  
  // 1. Get document metadata to check if it's already processed or if we need to skip
  const doc = await client.getDocument(documentId);
  
  // 2. Download the file (prefer thumbnail for OCR)
  let fileBuffer: Buffer;
  try {
    fileBuffer = await client.getDocumentThumbnail(documentId);
    console.log(`Using thumbnail for document ${documentId}`);
  } catch (error) {
    console.log(`Thumbnail unavailable, using raw file for document ${documentId}`);
    fileBuffer = await client.getDocumentFile(documentId);
  }
  const base64 = fileBuffer.toString("base64");
  
  // 3. Extract data using Together AI (ReceiptHero logic)
  const receipts = await extractReceiptData(base64);
  
  if (receipts.length === 0) {
    console.log(`No receipt data found for document ${documentId}`);
    return;
  }

  // Use the first receipt found (assuming 1 file = 1 receipt mostly, or handle multiple)
  const receipt = receipts[0];
  
  // 4. Prepare updates for Paperless
  const processedTagId = await client.getOrCreateTag("ai-processed");
  const correspondentId = await client.getOrCreateCorrespondent(receipt.vendor);
  
  const currentTags = doc.tags || [];
  if (!currentTags.includes(processedTagId)) {
    currentTags.push(processedTagId);
  }

  // Update tags based on category
  const categoryTagId = await client.getOrCreateTag(receipt.category);
  if (!currentTags.includes(categoryTagId)) {
    currentTags.push(categoryTagId);
  }

  await client.updateDocument(documentId, {
    title: `${receipt.vendor} - ${receipt.amount} ${receipt.currency}`,
    created: receipt.date,
    correspondent: correspondentId,
    tags: currentTags,
  });

  console.log(`Successfully processed document ${documentId}`);
}

export async function runAutomation() {
  const host = process.env.PAPERLESS_HOST;
  const apiKey = process.env.PAPERLESS_API_KEY;
  
  if (!host || !apiKey) {
    console.error("Missing PAPERLESS_HOST or PAPERLESS_API_KEY environment variables");
    return;
  }

  const client = new PaperlessClient({ host, apiKey, processedTagName: "ai-processed" });
  
  const receiptTag = process.env.RECEIPT_TAG || "receipt";
  const unprocessed = await client.getUnprocessedDocuments(undefined, receiptTag);
  console.log(`Found ${unprocessed.length} unprocessed documents with tag "${receiptTag}"`);
  
  for (const doc of unprocessed) {
    try {
      await processPaperlessDocument(client, doc.id);
    } catch (error) {
      console.error(`Error processing document ${doc.id}:`, error);
    }
  }
}

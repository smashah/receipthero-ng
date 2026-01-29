import { PaperlessClient } from './paperless';
import { extractReceiptData } from './ocr';
import { loadConfig } from './config';
import { RetryQueue } from './retry-queue';
import { createTogetherClient } from './together-client';
import type { Together } from 'together-ai';

export async function processPaperlessDocument(
  client: PaperlessClient,
  documentId: number,
  togetherClient: Together,
  retryQueue?: RetryQueue,
  failedTag?: string
) {
  const attemptNum = retryQueue ? await retryQueue.getAttempts(documentId) + 1 : 1;
  const maxRetries = 3;
  
  if (retryQueue && attemptNum > 1) {
    console.log(`Retrying document ${documentId} (attempt ${attemptNum}/${maxRetries})`);
  } else {
    console.log(`Processing document ${documentId}...`);
  }
  
  try {
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
    const base64 = fileBuffer.toString('base64');
    
    // 3. Extract data using Together AI (ReceiptHero logic)
    const receipts = await extractReceiptData(base64, togetherClient);
    
    if (receipts.length === 0) {
      console.log(`No receipt data found for document ${documentId}`);
      // Success - remove from retry queue if present
      if (retryQueue) {
        await retryQueue.remove(documentId);
      }
      return;
    }

    // Use the first receipt found (assuming 1 file = 1 receipt mostly, or handle multiple)
    const receipt = receipts[0];
    
    // 4. Prepare updates for Paperless
    const processedTagId = await client.getOrCreateTag('ai-processed');
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
    
    // Success - remove from retry queue if present
    if (retryQueue) {
      await retryQueue.remove(documentId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (retryQueue) {
      // Check if we should give up (already at max retries)
      if (await retryQueue.shouldGiveUp(documentId)) {
        // Already at max attempts - tag as failed and remove from queue
        console.error(`Document ${documentId} failed after ${maxRetries} attempts: ${errorMessage}`);
        
        if (failedTag) {
          try {
            const failedTagId = await client.getOrCreateTag(failedTag);
            const doc = await client.getDocument(documentId);
            const currentTags = doc.tags || [];
            if (!currentTags.includes(failedTagId)) {
              currentTags.push(failedTagId);
              await client.updateDocument(documentId, { tags: currentTags });
              console.log(`Document ${documentId} tagged as "${failedTag}"`);
            }
          } catch (tagError) {
            console.error(`Failed to add "${failedTag}" tag to document ${documentId}:`, tagError);
          }
        }
        
        await retryQueue.remove(documentId);
      } else {
        // Add to retry queue (or increment attempts)
        await retryQueue.add(documentId, errorMessage);
        
        // Check if this was the last attempt
        if (await retryQueue.shouldGiveUp(documentId)) {
          console.error(`Document ${documentId} failed after ${maxRetries} attempts: ${errorMessage}`);
          
          if (failedTag) {
            try {
              const failedTagId = await client.getOrCreateTag(failedTag);
              const doc = await client.getDocument(documentId);
              const currentTags = doc.tags || [];
              if (!currentTags.includes(failedTagId)) {
                currentTags.push(failedTagId);
                await client.updateDocument(documentId, { tags: currentTags });
                console.log(`Document ${documentId} tagged as "${failedTag}"`);
              }
            } catch (tagError) {
              console.error(`Failed to add "${failedTag}" tag to document ${documentId}:`, tagError);
            }
          }
          
          await retryQueue.remove(documentId);
        }
      }
    } else {
      // No retry queue - just log the error
      console.error(`Error processing document ${documentId}:`, error);
    }
  }
}

export async function runAutomation() {
  // Load configuration
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    return;
  }

  const client = new PaperlessClient({
    host: config.paperless.host,
    apiKey: config.paperless.apiKey,
    processedTagName: config.processing.processedTag,
  });

  // Create Together AI client with optional Helicone
  const togetherClient = createTogetherClient(config);

  // Initialize retry queue
  const retryQueue = new RetryQueue(config.processing.maxRetries);
  await retryQueue.logStats();

  // 1. Process new unprocessed documents first
  const unprocessed = await client.getUnprocessedDocuments(undefined, config.processing.receiptTag);
  console.log(`Found ${unprocessed.length} unprocessed documents with tag "${config.processing.receiptTag}"`);
  
  for (const doc of unprocessed) {
    await processPaperlessDocument(client, doc.id, togetherClient, retryQueue, config.processing.failedTag);
  }

  // 2. Process documents from retry queue that are ready
  const readyForRetry = await retryQueue.getReadyForRetry();
  if (readyForRetry.length > 0) {
    console.log(`Processing ${readyForRetry.length} documents from retry queue`);
    
    for (const item of readyForRetry) {
      await processPaperlessDocument(client, item.documentId, togetherClient, retryQueue, config.processing.failedTag);
    }
  }
}

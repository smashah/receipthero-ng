import { PaperlessClient } from './paperless';
import { extractReceiptData } from './ocr';
import { loadConfig } from './config';
import { RetryQueue } from './retry-queue';
import { createTogetherClient } from './together-client';
import { reporter } from './reporter';
import { logger } from './logger';
import { skippedDocuments } from './skipped-documents';
import type { Together } from 'together-ai';

import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';

export async function processPaperlessDocument(
  client: PaperlessClient,
  documentId: number,
  togetherClient: Together,
  retryQueue?: RetryQueue,
  failedTag?: string,
  forceRetryStrategy?: 'full' | 'partial'
) {
  const config = loadConfig();
  const retryStrategy = forceRetryStrategy || config.processing.retryStrategy || 'partial';
  const attemptNum = retryQueue ? await retryQueue.getAttempts(documentId) + 1 : 1;
  const maxRetries = config.processing.maxRetries || 3;
  
  if (retryQueue && attemptNum > 1) {
    logger.info(`Retrying document ${documentId} (attempt ${attemptNum}/${maxRetries}) using ${retryStrategy} strategy`);
    await reporter.report('receipt:retry', { documentId, attempts: attemptNum, progress: 0, status: 'retrying' });
  } else {
    logger.info(`Processing document ${documentId}...`);
    await reporter.report('receipt:processing', { documentId, attempts: attemptNum, progress: 5, status: 'processing' });
  }
  
  try {
    let receipt: any = null;

    // Check if we can use existing data (Partial Retry)
    if (retryStrategy === 'partial') {
      const existing = await db
        .select()
        .from(schema.processingLogs)
        .where(eq(schema.processingLogs.documentId, documentId))
        .orderBy(desc(schema.processingLogs.id))
        .get();

      if (existing?.receiptData) {
        try {
          receipt = JSON.parse(existing.receiptData);
          logger.info(`Reusing existing receipt data for document ${documentId}`);
          await reporter.report('receipt:processing', { 
            documentId, 
            progress: 50, 
            message: 'Reusing existing extraction data' 
          });
        } catch (e) {
          logger.warn(`Failed to parse existing receipt data for ${documentId}, falling back to full extraction`);
        }
      }
    }

    if (!receipt) {
      // 1. Get document metadata
      const doc = await client.getDocument(documentId);
      await reporter.report('receipt:processing', { documentId, fileName: doc.title, progress: 10 });
      
      // 2. Download the file
      let fileBuffer: Buffer;
      try {
        fileBuffer = await client.getDocumentThumbnail(documentId);
        logger.info(`Using thumbnail for document ${documentId}`);
        await reporter.report('receipt:processing', { documentId, progress: 20, message: 'Using thumbnail' });
      } catch (error) {
        logger.info(`Thumbnail unavailable, using raw file for document ${documentId}`);
        await reporter.report('receipt:processing', { documentId, progress: 20, message: 'Downloading raw file' });
        fileBuffer = await client.getDocumentFile(documentId);
      }
      const base64 = fileBuffer.toString('base64');
      
      // 3. Extract data using Together AI
      await reporter.report('receipt:processing', { documentId, progress: 30, message: 'Extracting data with AI' });
      const receipts = await extractReceiptData(base64, togetherClient);
      
      if (receipts.length === 0) {
        logger.warn(`No receipt data found for document ${documentId}`);
        
        // Tag as skipped in Paperless
        const skippedTagName = config.processing.skippedTag;
        try {
          const skippedTagId = await client.getOrCreateTag(skippedTagName);
          const currentTags = doc.tags || [];
          if (!currentTags.includes(skippedTagId)) {
            currentTags.push(skippedTagId);
            await client.updateDocument(documentId, { tags: currentTags });
            logger.info(`Document ${documentId} tagged as "${skippedTagName}"`);
          }
        } catch (tagError) {
          logger.error(`Failed to add skipped tag to document ${documentId}:`, tagError);
        }
        
        // Track in skipped documents table
        await skippedDocuments.add(documentId, 'no_receipt_data', doc.title);
        
        await reporter.report('receipt:skipped', { documentId, progress: 100, message: 'No receipt data found (skipped)' });
        if (retryQueue) await retryQueue.remove(documentId);
        return;
      }
      receipt = receipts[0];
      
      // Persist extracted data immediately so retries can reuse it
      await reporter.report('receipt:processing', { 
        documentId, 
        progress: 50, 
        message: 'AI extraction complete',
        vendor: receipt.vendor,
        amount: Math.round(receipt.amount * 100),
        currency: receipt.currency,
        receiptData: JSON.stringify(receipt)
      });
    }

    // 4. Update Paperless-NGX
    await reporter.report('receipt:processing', { 
      documentId, 
      progress: 70, 
      message: 'Updating Paperless-NGX',
      vendor: receipt.vendor,
      amount: Math.round(receipt.amount * 100),
      currency: receipt.currency
    });
    
    const doc = await client.getDocument(documentId);
    const processedTagId = await client.getOrCreateTag(config.processing.processedTag);
    const correspondentId = await client.getOrCreateCorrespondent(receipt.vendor);
    
    const currentTags = doc.tags || [];
    if (!currentTags.includes(processedTagId)) {
      currentTags.push(processedTagId);
    }

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

    logger.info(`Successfully processed document ${documentId}`);
    await reporter.report('receipt:success', { 
      documentId, 
      progress: 100, 
      message: 'Processed successfully',
      vendor: receipt.vendor,
      amount: Math.round(receipt.amount * 100),
      currency: receipt.currency,
      receiptData: JSON.stringify(receipt)
    });
    
    if (retryQueue) await retryQueue.remove(documentId);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (retryQueue) {
      if (await retryQueue.shouldGiveUp(documentId)) {
        logger.error(`Document ${documentId} failed after ${maxRetries} attempts: ${errorMessage}`);
        await reporter.report('receipt:failed', { documentId, message: errorMessage, progress: 100 });
        
        if (failedTag) {
          try {
            const failedTagId = await client.getOrCreateTag(failedTag);
            const doc = await client.getDocument(documentId);
            const currentTags = doc.tags || [];
            if (!currentTags.includes(failedTagId)) {
              currentTags.push(failedTagId);
              await client.updateDocument(documentId, { tags: currentTags });
              logger.info(`Document ${documentId} tagged as "${failedTag}"`);
            }
          } catch (tagError) {
            logger.error(`Failed to add "${failedTag}" tag to document ${documentId}:`, tagError);
          }
        }
        
        await retryQueue.remove(documentId);
      } else {
        await retryQueue.add(documentId, errorMessage);
        await reporter.report('receipt:retry', { documentId, message: errorMessage, attempts: attemptNum, progress: 0 });
      }
    } else {
      logger.error(`Error processing document ${documentId}:`, errorMessage);
      await reporter.report('receipt:failed', { documentId, message: errorMessage, progress: 100 });
    }
  }
}

export async function runAutomation() {
  // Load configuration
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    logger.error('Failed to load configuration:', error);
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
  logger.info(`Found ${unprocessed.length} unprocessed documents with tag "${config.processing.receiptTag}"`);
  
  for (const doc of unprocessed) {
    await reporter.report('receipt:detected', { documentId: doc.id, fileName: doc.title, status: 'detected', progress: 0 });
    await processPaperlessDocument(client, doc.id, togetherClient, retryQueue, config.processing.failedTag);
  }

  // 2. Process documents from retry queue that are ready
  const readyForRetry = await retryQueue.getReadyForRetry();
  if (readyForRetry.length > 0) {
    logger.info(`Processing ${readyForRetry.length} documents from retry queue`);
    
    for (const item of readyForRetry) {
      await processPaperlessDocument(client, item.documentId, togetherClient, retryQueue, config.processing.failedTag);
    }
  }
}

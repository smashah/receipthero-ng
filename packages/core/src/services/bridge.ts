import { PaperlessClient } from './paperless';
import { extractReceiptData } from './ocr';
import { loadConfig } from './config';
import { RetryQueue } from './retry-queue';
import { createTogetherClient } from './together-client';
import { reporter } from './reporter';
import { createLogger } from './logger';
import { skippedDocuments } from './skipped-documents';
import type { Together } from 'together-ai';

import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';

const logger = createLogger('core');

/**
 * Process a single document from Paperless-NGX.
 * 
 * Pipeline stages:
 * 1. Check for existing receipt data (partial retry optimization)
 * 2. Fetch document metadata from Paperless
 * 3. Download thumbnail (preferred) or raw file
 * 4. Extract receipt data using Together AI OCR
 * 5. Create/update tags and correspondent in Paperless
 * 6. Update document with extracted data
 */
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

  logger.debug(`[doc:${documentId}] Starting processing`, {
    attempt: attemptNum,
    maxRetries,
    strategy: retryStrategy
  });

  if (retryQueue && attemptNum > 1) {
    logger.info(`[doc:${documentId}] Retrying (attempt ${attemptNum}/${maxRetries}) using ${retryStrategy} strategy`);
    await reporter.report('receipt:retry', { documentId, attempts: attemptNum, progress: 0, status: 'retrying' });
  } else {
    logger.info(`[doc:${documentId}] Processing started`);
    await reporter.report('receipt:processing', { documentId, attempts: attemptNum, progress: 5, status: 'processing' });
  }

  try {
    let receipt: any = null;

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1: Check for existing receipt data (Partial Retry Optimization)
    // ─────────────────────────────────────────────────────────────────────────
    if (retryStrategy === 'partial') {
      logger.debug(`[doc:${documentId}] Checking for existing receipt data in DB...`);

      const existing = await db
        .select()
        .from(schema.processingLogs)
        .where(eq(schema.processingLogs.documentId, documentId))
        .orderBy(desc(schema.processingLogs.id))
        .get();

      if (existing?.receiptData) {
        try {
          receipt = JSON.parse(existing.receiptData);
          logger.info(`[doc:${documentId}] ✓ Reusing existing receipt data from previous extraction`, {
            vendor: receipt.vendor,
            amount: receipt.amount
          });
          await reporter.report('receipt:processing', {
            documentId,
            progress: 50,
            message: 'Reusing existing extraction data'
          });
        } catch (e) {
          logger.warn(`[doc:${documentId}] Failed to parse existing receipt data, falling back to full extraction`);
        }
      } else {
        logger.debug(`[doc:${documentId}] No existing receipt data found, will perform full extraction`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2-4: Fetch document, download file, and extract data
    // ─────────────────────────────────────────────────────────────────────────
    if (!receipt) {
      // STAGE 2: Get document metadata from Paperless
      logger.debug(`[doc:${documentId}] Fetching document metadata from Paperless...`);
      let doc: any;
      try {
        doc = await client.getDocument(documentId);
        logger.info(`[doc:${documentId}] ✓ Got metadata: "${doc.title}"`, {
          correspondent: doc.correspondent,
          tags: doc.tags,
          created: doc.created
        });
      } catch (error: any) {
        logger.error(`[doc:${documentId}] ✗ Failed to get document metadata`, {
          error: error.message,
          hint: 'Check Paperless connection and document ID'
        });
        throw error;
      }
      await reporter.report('receipt:processing', { documentId, fileName: doc.title, progress: 10 });

      // STAGE 3: Download the file (prefer thumbnail for faster OCR)
      logger.debug(`[doc:${documentId}] Downloading document file...`);
      let fileBuffer: Buffer;
      let fileSource: 'thumbnail' | 'raw';

      try {
        fileBuffer = await client.getDocumentThumbnail(documentId);
        fileSource = 'thumbnail';
        logger.info(`[doc:${documentId}] ✓ Downloaded thumbnail (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
      } catch (thumbError: any) {
        logger.debug(`[doc:${documentId}] Thumbnail unavailable: ${thumbError.message}`);
        logger.debug(`[doc:${documentId}] Falling back to raw file download...`);

        try {
          fileBuffer = await client.getDocumentFile(documentId);
          fileSource = 'raw';
          logger.info(`[doc:${documentId}] ✓ Downloaded raw file (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (fileError: any) {
          logger.error(`[doc:${documentId}] ✗ Failed to download document file`, {
            thumbnailError: thumbError.message,
            rawFileError: fileError.message,
            hint: 'Check if document exists and is accessible'
          });
          throw fileError;
        }
      }
      await reporter.report('receipt:processing', {
        documentId,
        progress: 20,
        message: `Using ${fileSource}`
      });

      const base64 = fileBuffer.toString('base64');
      logger.debug(`[doc:${documentId}] Encoded file to base64 (${(base64.length / 1024).toFixed(1)} KB)`);

      // Get existing tag names to pass to AI for context
      const allTags = await client.getTags();
      const existingTagNames = doc.tags
        ?.map((tagId: number) => allTags.find((t: any) => t.id === tagId)?.name)
        .filter(Boolean) as string[] || [];
      logger.debug(`[doc:${documentId}] Existing tags: [${existingTagNames.join(', ')}]`);

      // STAGE 4: Extract data using Together AI
      logger.debug(`[doc:${documentId}] Sending to Together AI for OCR extraction...`);
      await reporter.report('receipt:processing', { documentId, progress: 30, message: 'Extracting data with AI' });

      let receipts: any[];
      try {
        receipts = await extractReceiptData(base64, togetherClient, { existingTags: existingTagNames });
        logger.debug(`[doc:${documentId}] ✓ AI extraction complete, found ${receipts.length} receipt(s)`);
      } catch (ocrError: any) {
        logger.error(`[doc:${documentId}] ✗ AI extraction failed`, {
          error: ocrError.message,
          hint: 'Check Together AI API key and rate limits'
        });
        throw ocrError;
      }

      // Handle case where no receipt data was found
      if (receipts.length === 0) {
        logger.warn(`[doc:${documentId}] No receipt data extracted from document`);

        // Tag as skipped in Paperless
        const skippedTagName = config.processing.skippedTag;
        logger.debug(`[doc:${documentId}] Adding skipped tag "${skippedTagName}"...`);

        try {
          const skippedTagId = await client.getOrCreateTag(skippedTagName);
          logger.debug(`[doc:${documentId}] Got/created skipped tag ID: ${skippedTagId}`);

          const currentTags = doc.tags || [];
          if (!currentTags.includes(skippedTagId)) {
            currentTags.push(skippedTagId);
            await client.updateDocument(documentId, { tags: currentTags });
            logger.info(`[doc:${documentId}] ✓ Tagged as "${skippedTagName}"`);
          } else {
            logger.debug(`[doc:${documentId}] Document already has skipped tag`);
          }
        } catch (tagError: any) {
          logger.error(`[doc:${documentId}] ✗ Failed to add skipped tag`, {
            error: tagError.message
          });
        }

        // Track in skipped documents table
        await skippedDocuments.add(documentId, 'no_receipt_data', doc.title);

        await reporter.report('receipt:skipped', { documentId, progress: 100, message: 'No receipt data found (skipped)' });
        if (retryQueue) await retryQueue.remove(documentId);
        return;
      }

      receipt = receipts[0];
      logger.info(`[doc:${documentId}] ✓ Extracted receipt data`, {
        vendor: receipt.vendor,
        amount: receipt.amount,
        currency: receipt.currency,
        date: receipt.date,
        category: receipt.category
      });

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

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 5-6: Update Paperless-NGX with extracted data
    // ─────────────────────────────────────────────────────────────────────────
    logger.debug(`[doc:${documentId}] Starting Paperless update phase...`);
    await reporter.report('receipt:processing', {
      documentId,
      progress: 70,
      message: 'Updating Paperless-NGX',
      vendor: receipt.vendor,
      amount: Math.round(receipt.amount * 100),
      currency: receipt.currency
    });

    // Re-fetch document to get current state (in case of retries)
    logger.debug(`[doc:${documentId}] Re-fetching document for update...`);
    let doc: any;
    try {
      doc = await client.getDocument(documentId);
      logger.debug(`[doc:${documentId}] ✓ Got current document state`, {
        currentTags: doc.tags
      });
    } catch (error: any) {
      logger.error(`[doc:${documentId}] ✗ Failed to re-fetch document for update`, {
        error: error.message
      });
      throw error;
    }

    // Get or create the processed tag
    logger.debug(`[doc:${documentId}] Getting/creating processed tag "${config.processing.processedTag}"...`);
    let processedTagId: number;
    try {
      processedTagId = await client.getOrCreateTag(config.processing.processedTag);
      logger.debug(`[doc:${documentId}] ✓ Processed tag ID: ${processedTagId}`);
    } catch (error: any) {
      logger.error(`[doc:${documentId}] ✗ Failed to get/create processed tag`, {
        tagName: config.processing.processedTag,
        error: error.message
      });
      throw error;
    }

    // Get or create correspondent for the vendor
    logger.debug(`[doc:${documentId}] Getting/creating correspondent "${receipt.vendor}"...`);
    let correspondentId: number;
    try {
      correspondentId = await client.getOrCreateCorrespondent(receipt.vendor);
      logger.debug(`[doc:${documentId}] ✓ Correspondent ID: ${correspondentId}`);
    } catch (error: any) {
      logger.error(`[doc:${documentId}] ✗ Failed to get/create correspondent`, {
        vendor: receipt.vendor,
        error: error.message
      });
      throw error;
    }

    // Build updated tags array
    const currentTags = doc.tags || [];
    if (!currentTags.includes(processedTagId)) {
      currentTags.push(processedTagId);
    }

    // Get or create category tag
    logger.debug(`[doc:${documentId}] Getting/creating category tag "${receipt.category}"...`);
    let categoryTagId: number;
    try {
      categoryTagId = await client.getOrCreateTag(receipt.category);
      logger.debug(`[doc:${documentId}] ✓ Category tag ID: ${categoryTagId}`);
    } catch (error: any) {
      logger.error(`[doc:${documentId}] ✗ Failed to get/create category tag`, {
        category: receipt.category,
        error: error.message
      });
      throw error;
    }

    if (!currentTags.includes(categoryTagId)) {
      currentTags.push(categoryTagId);
    }

    // Process AI-suggested tags (if any)
    if (receipt.suggested_tags?.length) {
      logger.debug(`[doc:${documentId}] Processing ${receipt.suggested_tags.length} suggested tags...`);
      const { tagIds: suggestedTagIds, errors: tagErrors } = await client.processTags(receipt.suggested_tags);

      for (const tagId of suggestedTagIds) {
        if (!currentTags.includes(tagId)) {
          currentTags.push(tagId);
        }
      }

      if (tagErrors.length > 0) {
        logger.warn(`[doc:${documentId}] Some suggested tags failed`, { errors: tagErrors });
      }
      logger.debug(`[doc:${documentId}] ✓ Added ${suggestedTagIds.length} suggested tags`);
    }

    // Apply the update to Paperless
    // Use AI-generated title if available, otherwise fallback to vendor + amount format
    const newTitle = receipt.title || `${receipt.vendor} - ${receipt.amount} ${receipt.currency}`;
    logger.debug(`[doc:${documentId}] Applying update to Paperless...`, {
      title: newTitle,
      created: receipt.date,
      correspondent: correspondentId,
      tags: currentTags
    });

    // Ensure json_payload custom field exists and prepare receipt data
    let jsonPayloadFieldId: number | null = null;
    try {
      jsonPayloadFieldId = await client.ensureCustomField('json_payload', 'longtext');
      logger.debug(`[doc:${documentId}] Using json_payload custom field ID: ${jsonPayloadFieldId}`);
    } catch (fieldError: any) {
      logger.warn(`[doc:${documentId}] ⚠ Failed to ensure json_payload custom field`, {
        error: fieldError.message
      });
      // Continue without custom field - not fatal
    }

    // Build custom fields payload with multi-schema structure
    const customFieldsPayload = jsonPayloadFieldId ? [{
      field: jsonPayloadFieldId,
      value: JSON.stringify({
        receipt_data: {
          vendor: receipt.vendor,
          amount: receipt.amount,
          currency: receipt.currency,
          date: receipt.date,
          category: receipt.category,
          paymentMethod: receipt.paymentMethod,
          taxAmount: receipt.taxAmount,
          title: receipt.title,
          summary: receipt.summary,
          line_items: receipt.line_items,
          suggested_tags: receipt.suggested_tags,
        }
      })
    }] : undefined;

    try {
      await client.updateDocument(documentId, {
        title: newTitle,
        created: receipt.date,
        correspondent: correspondentId,
        tags: currentTags,
        custom_fields: customFieldsPayload,
      });
      logger.info(`[doc:${documentId}] ✓ Successfully updated document in Paperless`, {
        title: newTitle,
        correspondent: receipt.vendor,
        category: receipt.category,
        hasCustomField: !!jsonPayloadFieldId
      });
    } catch (error: any) {
      logger.error(`[doc:${documentId}] ✗ Failed to update document in Paperless`, {
        error: error.message,
        attempted: { title: newTitle, tags: currentTags }
      });
      throw error;
    }

    // Add receipt summary and JSON as a note to the document
    try {
      // Generate a fallback summary if AI didn't provide one
      const summaryText = receipt.summary ||
        `Purchase from ${receipt.vendor} on ${receipt.date}. Total: ${receipt.amount} ${receipt.currency}. Category: ${receipt.category}. Payment: ${receipt.paymentMethod}.`;

      const noteContent = `## Receipt Summary\n\n${summaryText}\n\n---\n\n## Raw Data (Reference)\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\``;
      await client.addNote(documentId, noteContent);
      logger.info(`[doc:${documentId}] ✓ Added receipt summary and JSON as note`);
    } catch (noteError: any) {
      // Non-fatal: log but don't fail the whole process
      logger.warn(`[doc:${documentId}] ⚠ Failed to add receipt note`, {
        error: noteError.message
      });
    }

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
    logger.error(`[doc:${documentId}] Processing failed`, { error: errorMessage });

    if (retryQueue) {
      if (await retryQueue.shouldGiveUp(documentId)) {
        logger.error(`[doc:${documentId}] ✗ Giving up after ${maxRetries} attempts`);
        await reporter.report('receipt:failed', { documentId, message: errorMessage, progress: 100 });

        // Add failed tag
        if (failedTag) {
          logger.debug(`[doc:${documentId}] Adding failed tag "${failedTag}"...`);
          try {
            const failedTagId = await client.getOrCreateTag(failedTag);
            const doc = await client.getDocument(documentId);
            const currentTags = doc.tags || [];
            if (!currentTags.includes(failedTagId)) {
              currentTags.push(failedTagId);
              await client.updateDocument(documentId, { tags: currentTags });
              logger.info(`[doc:${documentId}] ✓ Tagged as "${failedTag}"`);
            }
          } catch (tagError: any) {
            logger.error(`[doc:${documentId}] ✗ Failed to add failed tag`, {
              error: tagError.message
            });
          }
        }

        await retryQueue.remove(documentId);
      } else {
        logger.info(`[doc:${documentId}] Scheduling for retry...`);
        await retryQueue.add(documentId, errorMessage);
        await reporter.report('receipt:retry', { documentId, message: errorMessage, attempts: attemptNum, progress: 0 });
      }
    } else {
      await reporter.report('receipt:failed', { documentId, message: errorMessage, progress: 100 });
    }
  }
}

/**
 * Run the full automation cycle:
 * 1. Find unprocessed documents with receipt tag
 * 2. Process each document
 * 3. Process documents from retry queue
 */
export async function runAutomation() {
  logger.info('Starting automation cycle...');

  // Load configuration
  let config;
  try {
    config = loadConfig();
    logger.debug('Configuration loaded', {
      paperlessHost: config.paperless.host,
      receiptTag: config.processing.receiptTag,
      processedTag: config.processing.processedTag
    });
  } catch (error: any) {
    logger.error('Failed to load configuration', { error: error.message });
    return;
  }

  // Initialize Paperless client
  logger.debug('Initializing Paperless client...');
  const client = new PaperlessClient({
    host: config.paperless.host,
    apiKey: config.paperless.apiKey,
    processedTagName: config.processing.processedTag,
  });

  // Create Together AI client with optional Helicone
  logger.debug('Initializing Together AI client...');
  const togetherClient = createTogetherClient(config);

  // Initialize retry queue
  const retryQueue = new RetryQueue(config.processing.maxRetries);
  await retryQueue.logStats();

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: Process new unprocessed documents
  // ─────────────────────────────────────────────────────────────────────────
  logger.debug(`Fetching unprocessed documents with tag "${config.processing.receiptTag}"...`);
  let unprocessed: any[];
  try {
    unprocessed = await client.getUnprocessedDocuments(undefined, config.processing.receiptTag);
    logger.info(`Found ${unprocessed.length} unprocessed document(s) with tag "${config.processing.receiptTag}"`);
  } catch (error: any) {
    logger.error('Failed to fetch unprocessed documents from Paperless', {
      error: error.message,
      hint: 'Check Paperless connection and API key'
    });
    return;
  }

  for (const doc of unprocessed) {
    logger.debug(`Queuing document ${doc.id}: "${doc.title}"`);
    await reporter.report('receipt:detected', { documentId: doc.id, fileName: doc.title, status: 'detected', progress: 0 });
    await processPaperlessDocument(client, doc.id, togetherClient, retryQueue, config.processing.failedTag);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Process documents from retry queue
  // ─────────────────────────────────────────────────────────────────────────
  const readyForRetry = await retryQueue.getReadyForRetry();
  if (readyForRetry.length > 0) {
    logger.info(`Processing ${readyForRetry.length} document(s) from retry queue`);

    for (const item of readyForRetry) {
      logger.debug(`Processing retry for document ${item.documentId} (attempt ${item.attempts + 1})`);
      await processPaperlessDocument(client, item.documentId, togetherClient, retryQueue, config.processing.failedTag);
    }
  }

  logger.info('Automation cycle complete');
}

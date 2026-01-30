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
 * Converts receipt data into a human-readable markdown string.
 * Used to update the Paperless document content for improved searchability.
 */
function receiptToMarkdown(receipt: any): string {
  const getSymbol = (currencyCode: string) => {
    const symbols: Record<string, string> = {
      'GBP': '£',
      'USD': '$',
      'EUR': '€',
      'JPY': '¥',
      'AED': 'AED ',
    };
    return symbols[currencyCode] || currencyCode + ' ';
  };

  const symbol = getSymbol(receipt.currency);

  // Format line items if available
  const itemsList = receipt.line_items?.length
    ? receipt.line_items.map((item: any) =>
      `* ${item.quantity} x **${item.name}** — ${symbol}${item.unitPrice?.toFixed(2) || item.totalPrice?.toFixed(2) || '?'}`
    ).join('\n')
    : '_No line items_';

  // Augment tags with vendor and year for better searchability
  const year = receipt.date?.split('-')[0] || '';
  const allTags = [...(receipt.suggested_tags || []), receipt.vendor?.split(' ')[0], year].filter(Boolean);

  return `### **${receipt.vendor}**
**Date:** ${receipt.date}
**Category:** ${receipt.category?.charAt(0).toUpperCase() + receipt.category?.slice(1)}

---

**Items Purchased:**
${itemsList}

---

**Total: ${symbol}${receipt.amount?.toFixed(2)} ${receipt.currency}**
**Payment Method:** ${receipt.paymentMethod}
**Tax:** ${symbol}${receipt.taxAmount?.toFixed(2)}

**Search Tags:** ${allTags.join(', ')}`;
}

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

  // Create a document-scoped logger for this processing job
  const docLogger = logger.withDocument(documentId);

  docLogger.debug(`Starting processing`, {
    attempt: attemptNum,
    maxRetries,
    strategy: retryStrategy
  });

  if (retryQueue && attemptNum > 1) {
    docLogger.info(`Retrying (attempt ${attemptNum}/${maxRetries}) using ${retryStrategy} strategy`);
    await reporter.report('receipt:retry', { documentId, attempts: attemptNum, progress: 0, status: 'retrying' });
  } else {
    docLogger.info(`Processing started`);
    await reporter.report('receipt:processing', { documentId, attempts: attemptNum, progress: 5, status: 'processing' });
  }

  try {
    let receipt: any = null;

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1: Check for existing receipt data (Partial Retry Optimization)
    // ─────────────────────────────────────────────────────────────────────────
    if (retryStrategy === 'partial') {
      docLogger.debug(` Checking for existing receipt data in DB...`);

      const existing = await db
        .select()
        .from(schema.processingLogs)
        .where(eq(schema.processingLogs.documentId, documentId))
        .orderBy(desc(schema.processingLogs.id))
        .get();

      if (existing?.receiptData) {
        try {
          receipt = JSON.parse(existing.receiptData);
          docLogger.info(` ✓ Reusing existing receipt data from previous extraction`, {
            vendor: receipt.vendor,
            amount: receipt.amount
          });
          await reporter.report('receipt:processing', {
            documentId,
            progress: 50,
            message: 'Reusing existing extraction data'
          });
        } catch (e) {
          docLogger.warn(` Failed to parse existing receipt data, falling back to full extraction`);
        }
      } else {
        docLogger.debug(` No existing receipt data found, will perform full extraction`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2-4: Fetch document, download file, and extract data
    // ─────────────────────────────────────────────────────────────────────────
    if (!receipt) {
      // STAGE 2: Get document metadata from Paperless
      docLogger.debug(` Fetching document metadata from Paperless...`);
      let doc: any;
      try {
        doc = await client.getDocument(documentId);
        docLogger.info(` ✓ Got metadata: "${doc.title}"`, {
          correspondent: doc.correspondent,
          tags: doc.tags,
          created: doc.created
        });
      } catch (error: any) {
        docLogger.error(` ✗ Failed to get document metadata`, {
          error: error.message,
          hint: 'Check Paperless connection and document ID'
        });
        throw error;
      }
      await reporter.report('receipt:processing', { documentId, fileName: doc.title, progress: 10 });

      // STAGE 3: Download the file (prefer thumbnail for faster OCR)
      docLogger.debug(` Downloading document file...`);
      let fileBuffer: Buffer;
      let fileSource: 'thumbnail' | 'raw';

      try {
        fileBuffer = await client.getDocumentImage(documentId);
        fileSource = 'thumbnail';
        docLogger.info(` ✓ Downloaded thumbnail (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
      } catch (thumbError: any) {
        docLogger.debug(` Thumbnail unavailable: ${thumbError.message}`);
        docLogger.debug(` Falling back to raw file download...`);

        try {
          fileBuffer = await client.getDocumentFile(documentId);
          fileSource = 'raw';
          docLogger.info(` ✓ Downloaded raw file (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (fileError: any) {
          docLogger.error(` ✗ Failed to download document file`, {
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
      docLogger.debug(` Encoded file to base64 (${(base64.length / 1024).toFixed(1)} KB)`);

      // Get existing tag names to pass to AI for context
      const allTags = await client.getTags();
      const existingTagNames = doc.tags
        ?.map((tagId: number) => allTags.find((t: any) => t.id === tagId)?.name)
        .filter(Boolean) as string[] || [];
      docLogger.debug(` Existing tags: [${existingTagNames.join(', ')}]`);

      // STAGE 4: Extract data using Together AI
      docLogger.debug(` Sending to Together AI for OCR extraction...`);
      await reporter.report('receipt:processing', { documentId, progress: 30, message: 'Extracting data with AI' });

      let receipts: any[];
      try {
        receipts = await extractReceiptData(base64, togetherClient, { existingTags: existingTagNames });
        docLogger.debug(` ✓ AI extraction complete, found ${receipts.length} receipt(s)`);
      } catch (ocrError: any) {
        docLogger.error(` ✗ AI extraction failed`, {
          error: ocrError.message,
          hint: 'Check Together AI API key and rate limits'
        });
        throw ocrError;
      }

      // Handle case where no receipt data was found
      if (receipts.length === 0) {
        docLogger.warn(` No receipt data extracted from document`);

        // Tag as skipped in Paperless
        const skippedTagName = config.processing.skippedTag;
        docLogger.debug(` Adding skipped tag "${skippedTagName}"...`);

        try {
          const skippedTagId = await client.getOrCreateTag(skippedTagName);
          docLogger.debug(` Got/created skipped tag ID: ${skippedTagId}`);

          const currentTags = doc.tags || [];
          if (!currentTags.includes(skippedTagId)) {
            currentTags.push(skippedTagId);
            await client.updateDocument(documentId, { tags: currentTags });
            docLogger.info(` ✓ Tagged as "${skippedTagName}"`);
          } else {
            docLogger.debug(` Document already has skipped tag`);
          }
        } catch (tagError: any) {
          docLogger.error(` ✗ Failed to add skipped tag`, {
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
      docLogger.info(` ✓ Extracted receipt data`, {
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
    docLogger.debug(` Starting Paperless update phase...`);
    await reporter.report('receipt:processing', {
      documentId,
      progress: 70,
      message: 'Updating Paperless-NGX',
      vendor: receipt.vendor,
      amount: Math.round(receipt.amount * 100),
      currency: receipt.currency
    });

    // Re-fetch document to get current state (in case of retries)
    docLogger.debug(` Re-fetching document for update...`);
    let doc: any;
    try {
      doc = await client.getDocument(documentId);
      docLogger.debug(` ✓ Got current document state`, {
        currentTags: doc.tags
      });
    } catch (error: any) {
      docLogger.error(` ✗ Failed to re-fetch document for update`, {
        error: error.message
      });
      throw error;
    }

    // Get or create the processed tag
    docLogger.debug(` Getting/creating processed tag "${config.processing.processedTag}"...`);
    let processedTagId: number;
    try {
      processedTagId = await client.getOrCreateTag(config.processing.processedTag);
      docLogger.debug(` ✓ Processed tag ID: ${processedTagId}`);
    } catch (error: any) {
      docLogger.error(` ✗ Failed to get/create processed tag`, {
        tagName: config.processing.processedTag,
        error: error.message
      });
      throw error;
    }

    // Get or create correspondent for the vendor
    docLogger.debug(` Getting/creating correspondent "${receipt.vendor}"...`);
    let correspondentId: number;
    try {
      correspondentId = await client.getOrCreateCorrespondent(receipt.vendor);
      docLogger.debug(` ✓ Correspondent ID: ${correspondentId}`);
    } catch (error: any) {
      docLogger.error(` ✗ Failed to get/create correspondent`, {
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
    docLogger.debug(` Getting/creating category tag "${receipt.category}"...`);
    let categoryTagId: number;
    try {
      categoryTagId = await client.getOrCreateTag(receipt.category);
      docLogger.debug(` ✓ Category tag ID: ${categoryTagId}`);
    } catch (error: any) {
      docLogger.error(` ✗ Failed to get/create category tag`, {
        category: receipt.category,
        error: error.message
      });
      throw error;
    }

    if (!currentTags.includes(categoryTagId)) {
      currentTags.push(categoryTagId);
    }

    // Process AI-suggested tags (if config.processing.autoTag is enabled)
    if (config.processing.autoTag && receipt.suggested_tags?.length) {
      docLogger.debug(` Processing ${receipt.suggested_tags.length} suggested tags...`);
      const { tagIds: suggestedTagIds, errors: tagErrors } = await client.processTags(receipt.suggested_tags);

      for (const tagId of suggestedTagIds) {
        if (!currentTags.includes(tagId)) {
          currentTags.push(tagId);
        }
      }

      if (tagErrors.length > 0) {
        docLogger.warn(` Some suggested tags failed`, { errors: tagErrors });
      }
      docLogger.debug(` ✓ Added ${suggestedTagIds.length} suggested tags`);
    } else if (!config.processing.autoTag) {
      docLogger.debug(` Skipping suggested tags (autoTag disabled)`);
    }

    // Apply the update to Paperless
    // Use AI-generated title if available, otherwise fallback to vendor + amount format
    const newTitle = receipt.title || `${receipt.vendor} - ${receipt.amount} ${receipt.currency}`;
    docLogger.debug(` Applying update to Paperless...`, {
      title: newTitle,
      created: receipt.date,
      correspondent: correspondentId,
      tags: currentTags
    });

    // Ensure json_payload custom field exists and prepare receipt data (if enabled)
    let jsonPayloadFieldId: number | null = null;
    let customFieldsPayload: Array<{ field: number; value: string }> | undefined = undefined;

    if (config.processing.addJsonPayload) {
      try {
        jsonPayloadFieldId = await client.ensureCustomField('json_payload', 'longtext');
        docLogger.debug(` Using json_payload custom field ID: ${jsonPayloadFieldId}`);
      } catch (fieldError: any) {
        docLogger.warn(` ⚠ Failed to ensure json_payload custom field`, {
          error: fieldError.message
        });
        // Continue without custom field - not fatal
      }

      // Build custom fields payload with multi-schema structure
      if (jsonPayloadFieldId) {
        customFieldsPayload = [{
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
        }];
      }
    } else {
      docLogger.debug(` Skipping json_payload custom field (addJsonPayload disabled)`);
    }

    // Build formatted content with receipt data and preserve raw OCR (if enabled)
    let newContent: string | undefined = undefined;
    if (config.processing.updateContent) {
      const formattedContent = receiptToMarkdown(receipt);
      const existingContent = doc.content || '';
      newContent = existingContent
        ? `${formattedContent}\n\n---\n\n### Raw OCR Text\n\n${existingContent}`
        : formattedContent;
    } else {
      docLogger.debug(` Skipping content update (updateContent disabled)`);
    }

    try {
      await client.updateDocument(documentId, {
        title: newTitle,
        created: receipt.date,
        correspondent: correspondentId,
        tags: currentTags,
        ...(newContent && { content: newContent }),
        ...(customFieldsPayload && { custom_fields: customFieldsPayload }),
      });
      docLogger.info(` ✓ Successfully updated document in Paperless`, {
        title: newTitle,
        correspondent: receipt.vendor,
        category: receipt.category,
        hasCustomField: !!jsonPayloadFieldId
      });
    } catch (error: any) {
      docLogger.error(` ✗ Failed to update document in Paperless`, {
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
      docLogger.info(` ✓ Added receipt summary and JSON as note`);
    } catch (noteError: any) {
      // Non-fatal: log but don't fail the whole process
      docLogger.warn(` ⚠ Failed to add receipt note`, {
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
    docLogger.error(` Processing failed`, { error: errorMessage });

    if (retryQueue) {
      if (await retryQueue.shouldGiveUp(documentId)) {
        docLogger.error(` ✗ Giving up after ${maxRetries} attempts`);
        await reporter.report('receipt:failed', { documentId, message: errorMessage, progress: 100 });

        // Add failed tag
        if (failedTag) {
          docLogger.debug(` Adding failed tag "${failedTag}"...`);
          try {
            const failedTagId = await client.getOrCreateTag(failedTag);
            const doc = await client.getDocument(documentId);
            const currentTags = doc.tags || [];
            if (!currentTags.includes(failedTagId)) {
              currentTags.push(failedTagId);
              await client.updateDocument(documentId, { tags: currentTags });
              docLogger.info(` ✓ Tagged as "${failedTag}"`);
            }
          } catch (tagError: any) {
            docLogger.error(` ✗ Failed to add failed tag`, {
              error: tagError.message
            });
          }
        }

        await retryQueue.remove(documentId);
      } else {
        docLogger.info(` Scheduling for retry...`);
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
 * 
 * Note: Concurrency control is handled by the caller via workerState.acquireLock()
 */
export async function runAutomation(): Promise<{
  documentsFound: number;
  documentsQueued: number;
  documentsSkipped: number;
}> {
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
    return { documentsFound: 0, documentsQueued: 0, documentsSkipped: 0 };
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
    return { documentsFound: 0, documentsQueued: 0, documentsSkipped: 0 };
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

  const documentsQueued = unprocessed.length + readyForRetry.length;
  logger.info('Automation cycle complete');

  return {
    documentsFound: unprocessed.length,
    documentsQueued,
    documentsSkipped: 0, // Could track skipped docs in future
  };
}


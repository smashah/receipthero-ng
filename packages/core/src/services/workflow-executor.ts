import { PaperlessClient } from './paperless';
import { extractWithSchema } from './extract';
import { loadConfig } from './config';
import { RetryQueue } from './retry-queue';
import { createAIAdapter, type AIAdapter } from './ai-client';
import { reporter } from './reporter';
import { createLogger } from './logger';
import { skippedDocuments } from './skipped-documents';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import type { Workflow } from '../db/schema';
import type { WorkflowOutputMapping } from '@sm-rn/shared/workflow-schemas';

const logger = createLogger('core');

/**
 * Generic data to markdown formatter.
 */
export function dataToMarkdown(data: Record<string, unknown>, workflowName: string): string {
  const entries = Object.entries(data)
    .filter(([key]) => !['line_items', 'suggested_tags', 'conversions', 'title', 'summary'].includes(key))
    .map(([key, value]) => `**${key.charAt(0).toUpperCase() + key.slice(1)}:** ${value}`)
    .join('\n');

  let content = `### **${workflowName} Data**\n${entries}`;

  if (data.summary) {
    content = `### **Summary**\n${data.summary}\n\n---\n\n${content}`;
  }

  if (Array.isArray(data.line_items) && data.line_items.length > 0) {
    const items = data.line_items.map((item: any) => 
      `* ${item.quantity || 1} x **${item.name}** — ${item.totalPrice || item.unitPrice || '?'}`
    ).join('\n');
    content += `\n\n**Items:**\n${items}`;
  }

  if (Array.isArray(data.suggested_tags) && data.suggested_tags.length > 0) {
    content += `\n\n**Suggested Tags:** ${data.suggested_tags.join(', ')}`;
  }

  return content;
}

/**
 * Simple template interpolator.
 */
export function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return String(data[key] ?? match);
  });
}

/**
 * Generic workflow executor.
 */
export async function executeWorkflow(
  client: PaperlessClient,
  documentId: number,
  workflow: Workflow,
  adapter: AIAdapter,
  retryQueue?: RetryQueue
) {
  const config = loadConfig();
  const attemptNum = retryQueue ? await retryQueue.getAttempts(documentId) + 1 : 1;
  const maxRetries = config.processing.maxRetries || 3;
  const docLogger = logger.withDocument(documentId);

  docLogger.info(`Starting workflow: ${workflow.name} (attempt ${attemptNum}/${maxRetries})`);
  await reporter.report('workflow:processing', { 
    documentId, 
    workflowId: workflow.id, 
    workflowName: workflow.name, 
    attempts: attemptNum, 
    progress: 5, 
    status: 'processing' 
  });

  try {
    let extractedData: any = null;

    // Check for existing data (Partial Retry)
    const existing = await db
      .select()
      .from(schema.processingLogs)
      .where(eq(schema.processingLogs.documentId, documentId))
      .orderBy(desc(schema.processingLogs.id))
      .get();

    if (existing?.extractedData) {
      try {
        extractedData = JSON.parse(existing.extractedData);
        docLogger.info(`✓ Reusing existing data for ${workflow.name}`);
        await reporter.report('workflow:processing', { documentId, progress: 50, message: 'Reusing existing data' });
      } catch (e) {
        docLogger.warn(`Failed to parse existing data, re-extracting`);
      }
    }

    if (!extractedData) {
      docLogger.debug(`Fetching document metadata...`);
      const doc = await client.getDocument(documentId);
      
      docLogger.debug(`Downloading file...`);
      let fileBuffer: Buffer;
      try {
        fileBuffer = await client.getDocumentImage(documentId);
      } catch (e) {
        fileBuffer = await client.getDocumentFile(documentId);
      }

      const base64 = fileBuffer.toString('base64');
      const allTags = await client.getTags();
      const existingTagNames = doc.tags?.map((id: number) => allTags.find((t: any) => t.id === id)?.name).filter(Boolean) || [];

      docLogger.info(`Sending to AI for extraction...`);
      const jsonSchema = JSON.parse(workflow.jsonSchema);
      const items = await extractWithSchema(base64, jsonSchema, workflow.promptInstructions || undefined, adapter, { existingTags: existingTagNames });

      if (items.length === 0) {
        docLogger.warn(`No data extracted`);
        if (workflow.skippedTag) {
          const tagId = await client.getOrCreateTag(workflow.skippedTag);
          const currentTags = doc.tags || [];
          if (!currentTags.includes(tagId)) {
            await client.updateDocument(documentId, { tags: [...currentTags, tagId] });
          }
        }
        await skippedDocuments.add(documentId, 'no_data', doc.title);
        await reporter.report('workflow:skipped', { documentId, progress: 100, message: 'No data found' });
        if (retryQueue) await retryQueue.remove(documentId);
        return;
      }

      extractedData = items[0];
      
      // Persist immediately
      await reporter.report('workflow:processing', {
        documentId,
        progress: 60,
        message: 'AI extraction complete',
        extractedData: JSON.stringify(extractedData)
      });
    }

    // Output Mapping
    const mapping: WorkflowOutputMapping = JSON.parse(workflow.outputMapping);
    const updates: any = {};

    // 1. Title
    if (workflow.titleTemplate) {
      updates.title = interpolateTemplate(workflow.titleTemplate, extractedData);
    } else if (extractedData.title) {
      updates.title = extractedData.title;
    }

    // 2. Date
    if (mapping.dateField && extractedData[mapping.dateField]) {
      updates.created = String(extractedData[mapping.dateField]);
    }

    // 3. Correspondent
    if (mapping.correspondentField && extractedData[mapping.correspondentField]) {
      const correspondentId = await client.getOrCreateCorrespondent(String(extractedData[mapping.correspondentField]));
      updates.correspondent = correspondentId;
    }

    // 4. Tags
    const doc = await client.getDocument(documentId);
    const tags = new Set<number>(doc.tags || []);
    
    // Processed tag
    const processedTagId = await client.getOrCreateTag(workflow.processedTag);
    tags.add(processedTagId);

    // Static tags
    for (const tagName of mapping.tagsToApply) {
      tags.add(await client.getOrCreateTag(tagName));
    }

    // Dynamic tags from fields
    for (const fieldName of mapping.tagFields) {
      if (extractedData[fieldName]) {
        tags.add(await client.getOrCreateTag(String(extractedData[fieldName])));
      }
    }

    // Suggested tags from AI (if any)
    if (Array.isArray(extractedData.suggested_tags)) {
      const { tagIds } = await client.processTags(extractedData.suggested_tags);
      tagIds.forEach(id => tags.add(id));
    }

    updates.tags = Array.from(tags);

    // 5. Custom Fields
    if (Object.keys(mapping.customFields).length > 0) {
      const customFields: any[] = [];
      for (const [paperlessField, extractedField] of Object.entries(mapping.customFields)) {
        try {
          const fieldId = await client.ensureCustomField(paperlessField, 'longtext');
          const val = extractedField === '*' ? JSON.stringify(extractedData) : String(extractedData[extractedField as string] || '');
          if (val) customFields.push({ field: fieldId, value: val });
        } catch (e) {
          docLogger.warn(`Failed to set custom field ${paperlessField}`);
        }
      }
      if (customFields.length > 0) updates.custom_fields = customFields;
    }

    // 6. Content
    if (config.processing.updateContent) {
      const markdown = dataToMarkdown(extractedData, workflow.name);
      updates.content = doc.content ? `${markdown}\n\n---\n\n${doc.content}` : markdown;
    }

    // Apply updates
    await client.updateDocument(documentId, updates);
    
    // Add Note
    const note = `## Workflow: ${workflow.name}\n\n${extractedData.summary || 'Data extracted successfully.'}\n\n---\n\n\`\`\`json\n${JSON.stringify(extractedData, null, 2)}\n\`\`\``;
    await client.addNote(documentId, note);

    await reporter.report('workflow:success', {
      documentId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      progress: 100,
      message: 'Processed successfully',
      extractedData: JSON.stringify(extractedData)
    });

    if (retryQueue) await retryQueue.remove(documentId);

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    docLogger.error(`Workflow failed: ${msg}`);
    
    if (retryQueue) {
      if (await retryQueue.shouldGiveUp(documentId)) {
        await reporter.report('workflow:failed', { documentId, message: msg, progress: 100 });
        if (workflow.failedTag) {
          try {
            const tagId = await client.getOrCreateTag(workflow.failedTag);
            const doc = await client.getDocument(documentId);
            await client.updateDocument(documentId, { tags: [...(doc.tags || []), tagId] });
          } catch (e) {}
        }
        await retryQueue.remove(documentId);
      } else {
        await retryQueue.add(documentId, msg);
        await reporter.report('workflow:retry', { documentId, message: msg, attempts: attemptNum, progress: 0 });
      }
    } else {
      await reporter.report('workflow:failed', { documentId, message: msg, progress: 100 });
    }
  }
}

import { db, schema } from '../db';
import { eq, desc, count } from 'drizzle-orm';
import type { Workflow, NewWorkflow } from '../db/schema';
import { z } from 'zod';
import { loadConfig } from './config';
import { ProcessedReceiptSchema } from '@sm-rn/shared/types';

/**
 * Service for managing workflows.
 */

export async function getWorkflows(): Promise<Workflow[]> {
  return await db.select().from(schema.workflows).orderBy(desc(schema.workflows.priority)).all();
}

export async function getWorkflow(id: number): Promise<Workflow | undefined> {
  return await db.select().from(schema.workflows).where(eq(schema.workflows.id, id)).get();
}

export async function getWorkflowForTag(tagName: string): Promise<Workflow | undefined> {
  const all = await db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.triggerTag, tagName))
    .all();
  
  return all
    .filter(w => w.enabled)
    .sort((a, b) => b.priority - a.priority)[0];
}

export async function createWorkflow(data: any): Promise<Workflow> {
  const now = new Date().toISOString();
  const res = await db.insert(schema.workflows).values({
    ...data,
    outputMapping: typeof data.outputMapping === 'string' ? data.outputMapping : JSON.stringify(data.outputMapping),
    createdAt: now,
    updatedAt: now
  }).returning().get();
  return res as Workflow;
}

export async function updateWorkflow(id: number, data: any): Promise<Workflow> {
  const now = new Date().toISOString();
  const updates = { ...data, updatedAt: now };
  if (data.outputMapping && typeof data.outputMapping !== 'string') {
    updates.outputMapping = JSON.stringify(data.outputMapping);
  }
  
  const res = await db.update(schema.workflows)
    .set(updates)
    .where(eq(schema.workflows.id, id))
    .returning().get();
  
  if (!res) throw new Error('Workflow not found');
  return res as Workflow;
}

export async function deleteWorkflow(id: number): Promise<void> {
  await db.delete(schema.workflows).where(eq(schema.workflows.id, id));
}

export async function validateZodSource(zodSource: string) {
  // Static analysis
  const dangerous = ['import', 'require', 'eval', 'fetch', 'process', 'globalThis', 'Bun', 'Deno', 'window', 'document'];
  for (const pattern of dangerous) {
    if (zodSource.includes(pattern)) {
      return { valid: false, errors: [`Dangerous pattern detected: ${pattern}`] };
    }
  }

  try {
    // Execute to build schema
    const fn = new Function('z', `return ${zodSource}`);
    const result = fn(z);
    
    // Convert to JSON Schema
    const jsonSchema = z.toJSONSchema(result);
    return { valid: true, jsonSchema };
  } catch (error: any) {
    return { valid: false, errors: [error.message] };
  }
}

/**
 * Seeds the default built-in receipt workflow from configuration.
 */
export async function seedDefaultWorkflows() {
  const config = loadConfig();
  const [{ value: existingCount }] = await db.select({ value: count() }).from(schema.workflows);
  
  if (existingCount > 0) return;

  const now = new Date().toISOString();
  
  // The current receipt schema as a Zod source string
  const receiptZodSource = `z.object({
  id: z.string(),
  fileName: z.string(),
  date: z.string(),
  vendor: z.string(),
  category: z.string(),
  paymentMethod: z.string(),
  taxAmount: z.number(),
  amount: z.number(),
  currency: z.string().default('USD'),
  title: z.string().optional(),
  summary: z.string().optional(),
  line_items: z.array(z.object({
    name: z.string(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    totalPrice: z.number(),
  })).optional(),
  suggested_tags: z.array(z.string()).optional(),
})`;

  const outputMapping = {
    correspondentField: 'vendor',
    dateField: 'date',
    tagsToApply: [],
    tagFields: ['category'],
    customFields: { 'json_payload': '*' }
  };

  await db.insert(schema.workflows).values({
    name: 'Receipt',
    slug: 'receipt',
    description: 'Default workflow for processing receipts with AI.',
    enabled: true,
    priority: 100,
    triggerTag: config.processing.receiptTag,
    zodSource: receiptZodSource,
    jsonSchema: JSON.stringify(z.toJSONSchema(ProcessedReceiptSchema)),
    promptInstructions: 'You are an expert at extracting receipt data. Extract all receipts from the image as a JSON object matching the schema. CRITICAL: Date MUST be in YYYY-MM-DD format.',
    titleTemplate: '{vendor} - {amount} {currency}',
    outputMapping: JSON.stringify(outputMapping),
    processedTag: config.processing.processedTag,
    failedTag: config.processing.failedTag,
    skippedTag: config.processing.skippedTag,
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  }).run();
}

import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

/**
 * Service to track documents that were skipped during processing.
 */
export class SkippedDocumentsService {
  /**
   * Record a skipped document.
   */
  async add(documentId: number, reason: string, fileName?: string): Promise<void> {
    const existing = await db
      .select()
      .from(schema.skippedDocumentsSchema)
      .where(eq(schema.skippedDocumentsSchema.documentId, documentId))
      .get();

    if (existing) {
      // Update existing record
      await db
        .update(schema.skippedDocumentsSchema)
        .set({
          reason,
          fileName: fileName ?? existing.fileName,
          skippedAt: new Date().toISOString(),
        })
        .where(eq(schema.skippedDocumentsSchema.documentId, documentId))
        .run();
    } else {
      await db
        .insert(schema.skippedDocumentsSchema)
        .values({
          documentId,
          reason,
          fileName,
          skippedAt: new Date().toISOString(),
        })
        .run();
    }
  }

  /**
   * Remove a document from skipped list (if reprocessed successfully).
   */
  async remove(documentId: number): Promise<void> {
    await db
      .delete(schema.skippedDocumentsSchema)
      .where(eq(schema.skippedDocumentsSchema.documentId, documentId))
      .run();
  }

  /**
   * Check if a document is in the skipped list.
   */
  async has(documentId: number): Promise<boolean> {
    const item = await db
      .select()
      .from(schema.skippedDocumentsSchema)
      .where(eq(schema.skippedDocumentsSchema.documentId, documentId))
      .get();

    return !!item;
  }

  /**
   * Get total count of skipped documents.
   */
  async count(): Promise<number> {
    const result = await db
      .select()
      .from(schema.skippedDocumentsSchema)
      .all();

    return result.length;
  }

  /**
   * Get all skipped documents.
   */
  async getAll(): Promise<schema.SkippedDocumentEntry[]> {
    return await db
      .select()
      .from(schema.skippedDocumentsSchema)
      .all();
  }

  /**
   * Clear all skipped documents.
   */
  async clear(): Promise<number> {
    const count = await this.count();
    await db.delete(schema.skippedDocumentsSchema).run();
    return count;
  }
}

// Singleton instance
export const skippedDocuments = new SkippedDocumentsService();

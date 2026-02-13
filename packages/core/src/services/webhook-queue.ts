import { eq, and, lte } from 'drizzle-orm';
import { db, schema } from '../db';
import { createLogger } from './logger';

const logger = createLogger('core');

/**
 * Webhook queue service for managing document IDs received from Paperless-ngx webhooks.
 * Follows the same patterns as RetryQueue for consistency.
 */
export class WebhookQueueService {
  /**
   * Insert a new webhook delivery into the queue.
   * Idempotent: if documentId is already pending, skip (deduplication).
   */
  async enqueue(documentId: number, payload?: string): Promise<void> {
    // Check for existing pending entry with same documentId
    const existing = await db
      .select()
      .from(schema.webhookQueue)
      .where(
        and(
          eq(schema.webhookQueue.documentId, documentId),
          eq(schema.webhookQueue.status, 'pending')
        )
      )
      .get();

    if (existing) {
      logger.debug(`Document ${documentId} already in webhook queue (pending), skipping duplicate`);
      return;
    }

    await db
      .insert(schema.webhookQueue)
      .values({
        documentId,
        payload: payload ?? null,
        status: 'pending',
        receivedAt: new Date().toISOString(),
      })
      .run();

    logger.info(`Document ${documentId} added to webhook queue`);
  }

  /**
   * Get all pending document IDs and mark them as 'processing'.
   * Atomically reads and updates status to prevent double-processing.
   */
  async consumePending(): Promise<number[]> {
    const pending = await db
      .select()
      .from(schema.webhookQueue)
      .where(eq(schema.webhookQueue.status, 'pending'))
      .all();

    if (pending.length === 0) {
      return [];
    }

    // Mark all as processing
    for (const item of pending) {
      await db
        .update(schema.webhookQueue)
        .set({ status: 'processing' })
        .where(eq(schema.webhookQueue.id, item.id))
        .run();
    }

    const ids = pending.map(item => item.documentId);
    logger.info(`Consumed ${ids.length} document(s) from webhook queue: [${ids.join(', ')}]`);
    return ids;
  }

  /**
   * Mark a document as completed.
   */
  async markCompleted(documentId: number): Promise<void> {
    await db
      .update(schema.webhookQueue)
      .set({
        status: 'completed',
        processedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.webhookQueue.documentId, documentId),
          eq(schema.webhookQueue.status, 'processing')
        )
      )
      .run();
  }

  /**
   * Mark a document as failed.
   */
  async markFailed(documentId: number): Promise<void> {
    await db
      .update(schema.webhookQueue)
      .set({
        status: 'failed',
        processedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.webhookQueue.documentId, documentId),
          eq(schema.webhookQueue.status, 'processing')
        )
      )
      .run();
  }

  /**
   * Check if there are any pending items.
   */
  async hasPending(): Promise<boolean> {
    const item = await db
      .select()
      .from(schema.webhookQueue)
      .where(eq(schema.webhookQueue.status, 'pending'))
      .get();

    return !!item;
  }

  /**
   * Get queue statistics for the status endpoint.
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const all = await db
      .select()
      .from(schema.webhookQueue)
      .all();

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, total: all.length };
    for (const item of all) {
      if (item.status === 'pending') stats.pending++;
      else if (item.status === 'processing') stats.processing++;
      else if (item.status === 'completed') stats.completed++;
      else if (item.status === 'failed') stats.failed++;
    }
    return stats;
  }

  /**
   * Get recent webhook deliveries for the history endpoint.
   */
  async getRecent(limit: number = 50): Promise<schema.WebhookQueueEntry[]> {
    return await db
      .select()
      .from(schema.webhookQueue)
      .orderBy(schema.webhookQueue.id)
      .limit(limit)
      .all();
  }

  /**
   * Clean up old completed entries (older than N days).
   * Returns the number of entries removed.
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    const old = await db
      .select()
      .from(schema.webhookQueue)
      .where(
        and(
          eq(schema.webhookQueue.status, 'completed'),
          lte(schema.webhookQueue.processedAt, cutoff)
        )
      )
      .all();

    if (old.length === 0) return 0;

    for (const item of old) {
      await db
        .delete(schema.webhookQueue)
        .where(eq(schema.webhookQueue.id, item.id))
        .run();
    }

    logger.info(`Cleaned up ${old.length} completed webhook entries older than ${olderThanDays} days`);
    return old.length;
  }
}

// Singleton instance
export const webhookQueueService = new WebhookQueueService();

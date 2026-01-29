import { eq, lte } from 'drizzle-orm';
import { db, schema } from '../db';
import { createLogger } from './logger';

const logger = createLogger('queue');

/**
 * Retry queue with exponential backoff for failed document processing.
 * Uses Drizzle ORM with SQLite for persistence.
 */
export class RetryQueue {
  private maxRetries: number;

  // Backoff delays in milliseconds: 1min, 5min, 15min
  private static readonly BACKOFF_DELAYS = [
    60000,    // 1 minute
    300000,   // 5 minutes
    900000,   // 15 minutes
  ];

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  /**
   * Calculate backoff delay based on attempt number.
   * @param attempts Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  calculateBackoff(attempts: number): number {
    const index = Math.min(attempts - 1, RetryQueue.BACKOFF_DELAYS.length - 1);
    return RetryQueue.BACKOFF_DELAYS[Math.max(0, index)];
  }

  /**
   * Format delay for logging.
   */
  private formatDelay(ms: number): string {
    if (ms >= 60000) {
      return `${Math.round(ms / 60000)}min`;
    }
    return `${Math.round(ms / 1000)}s`;
  }

  /**
   * Add a failed document to the retry queue or increment its attempt count.
   */
  async add(documentId: number, error: string): Promise<void> {
    const existing = await db
      .select()
      .from(schema.retryQueue)
      .where(eq(schema.retryQueue.documentId, documentId))
      .get();

    const attempts = existing ? existing.attempts + 1 : 1;
    const delay = this.calculateBackoff(attempts);
    const nextRetryAt = new Date(Date.now() + delay).toISOString();

    if (existing) {
      await db
        .update(schema.retryQueue)
        .set({
          attempts,
          lastError: error,
          nextRetryAt,
        })
        .where(eq(schema.retryQueue.documentId, documentId))
        .run();
    } else {
      await db
        .insert(schema.retryQueue)
        .values({
          documentId,
          attempts,
          lastError: error,
          nextRetryAt,
        })
        .run();
    }

    logger.warn(`Document ${documentId} failed (attempt ${attempts}/${this.maxRetries}), will retry in ${this.formatDelay(delay)}`);
  }

  /**
   * Get all documents that are ready for retry (nextRetryAt <= now).
   */
  async getReadyForRetry() {
    const now = new Date().toISOString();
    return await db
      .select()
      .from(schema.retryQueue)
      .where(lte(schema.retryQueue.nextRetryAt, now))
      .all();
  }

  /**
   * Check if a document has exceeded the maximum retry attempts.
   */
  async shouldGiveUp(documentId: number): Promise<boolean> {
    const item = await db
      .select()
      .from(schema.retryQueue)
      .where(eq(schema.retryQueue.documentId, documentId))
      .get();

    if (!item) {
      return false;
    }
    return item.attempts >= this.maxRetries;
  }

  /**
   * Get the current attempt count for a document.
   */
  async getAttempts(documentId: number): Promise<number> {
    const item = await db
      .select()
      .from(schema.retryQueue)
      .where(eq(schema.retryQueue.documentId, documentId))
      .get();

    return item ? item.attempts : 0;
  }

  /**
   * Remove a document from the retry queue (after success or final failure).
   */
  async remove(documentId: number): Promise<void> {
    await db
      .delete(schema.retryQueue)
      .where(eq(schema.retryQueue.documentId, documentId))
      .run();
  }

  /**
   * Check if a document is in the retry queue.
   */
  async has(documentId: number): Promise<boolean> {
    const item = await db
      .select()
      .from(schema.retryQueue)
      .where(eq(schema.retryQueue.documentId, documentId))
      .get();

    return !!item;
  }

  /**
   * Get the total number of documents in the queue.
   */
  async size(): Promise<number> {
    const result = await db
      .select({ count: schema.retryQueue.id })
      .from(schema.retryQueue)
      .all();

    return result.length;
  }

  /**
   * Get all items in the retry queue.
   */
  async getAll(): Promise<schema.RetryQueueEntry[]> {
    return await db
      .select()
      .from(schema.retryQueue)
      .all();
  }

  /**
   * Reset all items to retry immediately (set nextRetryAt to now).
   * Returns the number of items reset.
   */
  async retryAll(): Promise<number> {
    const items = await this.getAll();
    const now = new Date().toISOString();

    for (const item of items) {
      await db
        .update(schema.retryQueue)
        .set({
          nextRetryAt: now,
          attempts: 0, // Reset attempts so they get full retry count
        })
        .where(eq(schema.retryQueue.id, item.id))
        .run();
    }

    logger.info(`Reset ${items.length} items for immediate retry`);
    return items.length;
  }

  /**
   * Clear all items from the retry queue.
   * Returns the number of items cleared.
   */
  async clear(): Promise<number> {
    const count = await this.size();
    await db.delete(schema.retryQueue).run();
    logger.info(`Cleared ${count} items from queue`);
    return count;
  }

  /**
   * Log queue statistics.
   */
  async logStats(): Promise<void> {
    const total = await this.size();
    const ready = await this.getReadyForRetry();
    logger.info(`${total} documents in queue, ${ready.length} ready for retry`);
  }
}

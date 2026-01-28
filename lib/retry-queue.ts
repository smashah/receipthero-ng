import * as fs from "fs";
import * as path from "path";

/**
 * State for a document in the retry queue.
 */
export interface RetryState {
  documentId: number;
  attempts: number;
  lastError: string;
  nextRetryAt: string; // ISO string for JSON persistence
}

/**
 * In-memory representation with Date object for comparisons.
 */
interface RetryStateInternal {
  documentId: number;
  attempts: number;
  lastError: string;
  nextRetryAt: Date;
}

/**
 * Retry queue with exponential backoff for failed document processing.
 * Persists state to a JSON file for survival across restarts.
 */
export class RetryQueue {
  private queue: Map<number, RetryStateInternal> = new Map();
  private filePath: string;
  private maxRetries: number;

  // Backoff delays in milliseconds: 1min, 5min, 15min
  private static readonly BACKOFF_DELAYS = [
    60000,    // 1 minute
    300000,   // 5 minutes
    900000,   // 15 minutes
  ];

  constructor(filePath: string, maxRetries: number = 3) {
    this.filePath = filePath;
    this.maxRetries = maxRetries;
    this.load();
  }

  /**
   * Load retry queue state from JSON file.
   */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, "utf-8");
        const data: RetryState[] = JSON.parse(content);
        
        for (const item of data) {
          this.queue.set(item.documentId, {
            documentId: item.documentId,
            attempts: item.attempts,
            lastError: item.lastError,
            nextRetryAt: new Date(item.nextRetryAt),
          });
        }
        
        console.log(`Retry queue: loaded ${this.queue.size} documents from ${this.filePath}`);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn(`Retry queue: corrupt JSON file at ${this.filePath}, starting fresh`);
      } else {
        console.warn(`Retry queue: could not load from ${this.filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.queue.clear();
    }
  }

  /**
   * Save retry queue state to JSON file.
   */
  save(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data: RetryState[] = Array.from(this.queue.values()).map((item) => ({
        documentId: item.documentId,
        attempts: item.attempts,
        lastError: item.lastError,
        nextRetryAt: item.nextRetryAt.toISOString(),
      }));

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error(`Retry queue: failed to save to ${this.filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
  add(documentId: number, error: string): void {
    const existing = this.queue.get(documentId);
    const attempts = existing ? existing.attempts + 1 : 1;
    const delay = this.calculateBackoff(attempts);
    const nextRetryAt = new Date(Date.now() + delay);

    this.queue.set(documentId, {
      documentId,
      attempts,
      lastError: error,
      nextRetryAt,
    });

    console.log(
      `Retry queue: document ${documentId} failed (attempt ${attempts}/${this.maxRetries}), will retry in ${this.formatDelay(delay)}`
    );

    this.save();
  }

  /**
   * Get all documents that are ready for retry (nextRetryAt <= now).
   */
  getReadyForRetry(): RetryStateInternal[] {
    const now = Date.now();
    const ready: RetryStateInternal[] = [];

    for (const item of this.queue.values()) {
      if (item.nextRetryAt.getTime() <= now) {
        ready.push(item);
      }
    }

    return ready;
  }

  /**
   * Check if a document has exceeded the maximum retry attempts.
   */
  shouldGiveUp(documentId: number): boolean {
    const item = this.queue.get(documentId);
    if (!item) {
      return false;
    }
    return item.attempts >= this.maxRetries;
  }

  /**
   * Get the current attempt count for a document.
   */
  getAttempts(documentId: number): number {
    const item = this.queue.get(documentId);
    return item ? item.attempts : 0;
  }

  /**
   * Remove a document from the retry queue (after success or final failure).
   */
  remove(documentId: number): void {
    if (this.queue.delete(documentId)) {
      this.save();
    }
  }

  /**
   * Check if a document is in the retry queue.
   */
  has(documentId: number): boolean {
    return this.queue.has(documentId);
  }

  /**
   * Get the total number of documents in the queue.
   */
  get size(): number {
    return this.queue.size;
  }

  /**
   * Log queue statistics.
   */
  logStats(): void {
    const ready = this.getReadyForRetry();
    console.log(`Retry queue: ${this.queue.size} documents, ${ready.length} ready for retry`);
  }
}

// Default retry queue file path
export const RETRY_QUEUE_PATH = "/app/data/retry-queue.json";

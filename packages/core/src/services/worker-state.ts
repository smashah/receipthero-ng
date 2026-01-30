import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

/**
 * Service to manage worker state (pause/resume).
 * Uses a single-row table for cross-process communication.
 */
export class WorkerStateService {
  private static readonly STATE_ID = 1;

  /**
   * Ensure the state row exists (called on startup).
   */
  async initialize(): Promise<void> {
    const existing = await db
      .select()
      .from(schema.workerStateSchema)
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .get();

    if (!existing) {
      await db
        .insert(schema.workerStateSchema)
        .values({
          id: WorkerStateService.STATE_ID,
          isPaused: false,
          updatedAt: new Date().toISOString(),
        })
        .run();
    }
  }

  /**
   * Check if worker is currently paused.
   */
  async isPaused(): Promise<boolean> {
    const state = await db
      .select()
      .from(schema.workerStateSchema)
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .get();

    return state?.isPaused ?? false;
  }

  /**
   * Get full worker state.
   */
  async getState(): Promise<{
    isPaused: boolean;
    pausedAt: string | null;
    pauseReason: string | null;
  }> {
    await this.initialize();

    const state = await db
      .select()
      .from(schema.workerStateSchema)
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .get();

    return {
      isPaused: state?.isPaused ?? false,
      pausedAt: state?.pausedAt ?? null,
      pauseReason: state?.pauseReason ?? null,
    };
  }

  /**
   * Pause the worker.
   */
  async pause(reason?: string): Promise<void> {
    await this.initialize();

    await db
      .update(schema.workerStateSchema)
      .set({
        isPaused: true,
        pausedAt: new Date().toISOString(),
        pauseReason: reason ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .run();
  }

  /**
   * Resume the worker.
   */
  async resume(): Promise<void> {
    await this.initialize();

    await db
      .update(schema.workerStateSchema)
      .set({
        isPaused: false,
        pausedAt: null,
        pauseReason: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .run();
  }

  /**
   * Request an immediate scan. The worker will pick this up and run a scan.
   */
  async triggerScan(): Promise<void> {
    await this.initialize();

    await db
      .update(schema.workerStateSchema)
      .set({
        scanRequested: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .run();
  }

  /**
   * Check if a scan was requested and consume the request.
   * Returns true if a scan was requested (and clears the flag).
   */
  async consumeScanRequest(): Promise<boolean> {
    const state = await db
      .select()
      .from(schema.workerStateSchema)
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .get();

    if (state?.scanRequested) {
      await db
        .update(schema.workerStateSchema)
        .set({
          scanRequested: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
        .run();
      return true;
    }
    return false;
  }

  /**
   * Trigger a scan and wait for the worker to pick it up.
   * Returns when the scan has been consumed or timeout is reached.
   * Ensures a minimum wait time for better UX.
   */
  async triggerScanAndWait(options?: {
    timeoutMs?: number;
    minWaitMs?: number;
    pollIntervalMs?: number;
  }): Promise<{
    consumed: boolean; durationMs: number; scanResult: {
      documentsFound: number;
      documentsQueued: number;
      documentsSkipped: number;
      timestamp: string;
    } | null
  }> {
    const timeoutMs = options?.timeoutMs ?? 30000; // 30 second timeout
    const minWaitMs = options?.minWaitMs ?? 1000;  // Minimum 1 second
    const pollIntervalMs = options?.pollIntervalMs ?? 200; // Poll every 200ms

    const startTime = Date.now();

    // Trigger the scan
    await this.triggerScan();

    // Poll until scan is consumed or timeout
    let consumed = false;
    while (Date.now() - startTime < timeoutMs) {
      const state = await db
        .select()
        .from(schema.workerStateSchema)
        .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
        .get();

      // If scanRequested is false, the worker has picked it up
      if (!state?.scanRequested) {
        consumed = true;
        break;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Ensure minimum wait time for better UX
    const elapsed = Date.now() - startTime;
    if (elapsed < minWaitMs) {
      await new Promise(resolve => setTimeout(resolve, minWaitMs - elapsed));
    }

    return {
      consumed,
      durationMs: Date.now() - startTime,
      scanResult: consumed ? await this.getLastScanResult() : null,
    };
  }

  /**
   * Set the result of the last scan (called by the worker after each scan).
   */
  async setScanResult(result: {
    documentsFound: number;
    documentsQueued: number;
    documentsSkipped: number;
    timestamp: string;
  }): Promise<void> {
    await db
      .update(schema.workerStateSchema)
      .set({
        lastScanResult: JSON.stringify(result),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .run();
  }

  /**
   * Get the result of the last scan.
   */
  async getLastScanResult(): Promise<{
    documentsFound: number;
    documentsQueued: number;
    documentsSkipped: number;
    timestamp: string;
  } | null> {
    const state = await db
      .select()
      .from(schema.workerStateSchema)
      .where(eq(schema.workerStateSchema.id, WorkerStateService.STATE_ID))
      .get();

    if (!state?.lastScanResult) return null;

    try {
      return JSON.parse(state.lastScanResult);
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const workerState = new WorkerStateService();

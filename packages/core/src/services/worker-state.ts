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
}

// Singleton instance
export const workerState = new WorkerStateService();

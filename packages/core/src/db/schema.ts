import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const retryQueue = sqliteTable('retry_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('documentId').unique().notNull(),
  attempts: integer('attempts').notNull(),
  lastError: text('lastError').notNull(),
  nextRetryAt: text('nextRetryAt').notNull(), // ISO date string
});

export type RetryQueueEntry = typeof retryQueue.$inferSelect;
export type NewRetryQueueEntry = typeof retryQueue.$inferInsert;

export const processingLogs = sqliteTable('processing_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('documentId').notNull(),
  status: text('status').notNull(), // 'detected', 'processing', 'completed', 'failed', 'retrying'
  message: text('message'),
  progress: integer('progress').notNull().default(0),
  attempts: integer('attempts').notNull().default(1),
  fileName: text('fileName'),
  vendor: text('vendor'),
  amount: integer('amount'), // Stored in cents/base units
  currency: text('currency'),
  receiptData: text('receiptData'), // Full extracted JSON string
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

export type ProcessingLogEntry = typeof processingLogs.$inferSelect;
export type NewProcessingLogEntry = typeof processingLogs.$inferInsert;

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(), // 'debug', 'info', 'warn', 'error'
  source: text('source').notNull(), // 'worker', 'api', 'core'
  message: text('message').notNull(),
  context: text('context'), // JSON string
  documentId: integer('documentId'), // Optional: links log to a specific document
});

export type LogEntryRow = typeof logs.$inferSelect;
export type NewLogEntryRow = typeof logs.$inferInsert;

// Worker state for pause/resume control (single row table)
export const workerStateSchema = sqliteTable('worker_state', {
  id: integer('id').primaryKey().default(1), // Always id=1, single row
  isPaused: integer('isPaused', { mode: 'boolean' }).notNull().default(false),
  pausedAt: text('pausedAt'), // ISO date string when paused
  pauseReason: text('pauseReason'), // Optional reason for pause
  scanRequested: integer('scanRequested', { mode: 'boolean' }).notNull().default(false), // Flag to trigger immediate scan
  lastScanResult: text('lastScanResult'), // JSON string with scan results (documentsFound, documentsQueued, etc.)
  lastScanCompletedAt: text('lastScanCompletedAt'), // ISO timestamp when last scan completed (for timer reset)
  isRunning: integer('isRunning', { mode: 'boolean' }).notNull().default(false), // Cross-process lock
  updatedAt: text('updatedAt').notNull(),
});

export type WorkerStateRow = typeof workerStateSchema.$inferSelect;
export type NewWorkerStateRow = typeof workerStateSchema.$inferInsert;

// Skipped documents tracking
export const skippedDocumentsSchema = sqliteTable('skipped_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('documentId').unique().notNull(),
  reason: text('reason').notNull(), // e.g., 'no_receipt_data', 'unsupported_format'
  fileName: text('fileName'),
  skippedAt: text('skippedAt').notNull(), // ISO date string
});

export type SkippedDocumentEntry = typeof skippedDocumentsSchema.$inferSelect;
export type NewSkippedDocumentEntry = typeof skippedDocumentsSchema.$inferInsert;

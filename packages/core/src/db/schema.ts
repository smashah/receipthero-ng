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
});

export type LogEntryRow = typeof logs.$inferSelect;
export type NewLogEntryRow = typeof logs.$inferInsert;

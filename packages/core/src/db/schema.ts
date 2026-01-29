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

CREATE TABLE `retry_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`attempts` integer NOT NULL,
	`lastError` text NOT NULL,
	`nextRetryAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retry_queue_documentId_unique` ON `retry_queue` (`documentId`);
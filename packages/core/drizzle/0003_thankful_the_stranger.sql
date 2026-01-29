CREATE TABLE `skipped_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`reason` text NOT NULL,
	`fileName` text,
	`skippedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skipped_documents_documentId_unique` ON `skipped_documents` (`documentId`);--> statement-breakpoint
CREATE TABLE `worker_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`isPaused` integer DEFAULT false NOT NULL,
	`pausedAt` text,
	`pauseReason` text,
	`updatedAt` text NOT NULL
);

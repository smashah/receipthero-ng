CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`documentId` integer
);
--> statement-breakpoint
CREATE TABLE `processing_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`fileName` text,
	`vendor` text,
	`amount` integer,
	`currency` text,
	`receiptData` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `retry_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`attempts` integer NOT NULL,
	`lastError` text NOT NULL,
	`nextRetryAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retry_queue_documentId_unique` ON `retry_queue` (`documentId`);--> statement-breakpoint
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
	`scanRequested` integer DEFAULT false NOT NULL,
	`lastScanResult` text,
	`updatedAt` text NOT NULL
);

CREATE TABLE `webhook_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`source` text DEFAULT 'paperless' NOT NULL,
	`payload` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`receivedAt` text NOT NULL,
	`processedAt` text
);

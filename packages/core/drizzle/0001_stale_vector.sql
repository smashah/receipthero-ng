CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`context` text
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
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);

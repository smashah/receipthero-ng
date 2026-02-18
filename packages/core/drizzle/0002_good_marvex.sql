CREATE TABLE `workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`triggerTag` text NOT NULL,
	`zodSource` text NOT NULL,
	`jsonSchema` text NOT NULL,
	`promptInstructions` text,
	`titleTemplate` text,
	`outputMapping` text NOT NULL,
	`processedTag` text NOT NULL,
	`failedTag` text,
	`skippedTag` text,
	`isBuiltIn` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflows_name_unique` ON `workflows` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `workflows_slug_unique` ON `workflows` (`slug`);--> statement-breakpoint
ALTER TABLE `processing_logs` ADD `workflowId` integer;--> statement-breakpoint
ALTER TABLE `processing_logs` ADD `extractedData` text;
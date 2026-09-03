CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`service` text NOT NULL,
	`subtype` text NOT NULL,
	`location` text NOT NULL,
	`documents_confirmed` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`queue_number` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_visits_code` ON `visits` (`code`);
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_code` text NOT NULL,
	`rating` integer NOT NULL,
	`issue` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_feedback_visit_code` ON `feedback` (`visit_code`);
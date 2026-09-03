ALTER TABLE `visits` ADD `service_counter` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_visits_queue_number` ON `visits` (`queue_number`);
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`follow_up_id` text NOT NULL,
	`type` text NOT NULL,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activities_follow_up` ON `activities` (`follow_up_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`account_name` text,
	`action_owner` text NOT NULL,
	`customer_contact` text,
	`next_action` text,
	`follow_up_at` text NOT NULL,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`customer_impact` text DEFAULT 'NONE' NOT NULL,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`source_url` text,
	`notes` text,
	`snooze_count` integer DEFAULT 0 NOT NULL,
	`last_chased_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_follow_ups_status_due` ON `follow_ups` (`status`,`follow_up_at`);--> statement-breakpoint
CREATE INDEX `idx_follow_ups_owner` ON `follow_ups` (`action_owner`);
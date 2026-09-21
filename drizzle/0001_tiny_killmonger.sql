DROP INDEX `users_email_unique`;--> statement-breakpoint
CREATE INDEX `idx_readings_user_date` ON `readings` (`user_id`,`reading_date`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_team_members_user_id` ON `team_members` (`user_id`);
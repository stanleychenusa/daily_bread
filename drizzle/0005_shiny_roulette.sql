ALTER TABLE `teams` ADD `join_code` text;--> statement-breakpoint
UPDATE `teams` SET `join_code` = upper(substr(replace(`id`, '-', ''), 1, 6)) WHERE `join_code` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teams_join_code` ON `teams` (`join_code`);

ALTER TABLE `user_sessions` MODIFY COLUMN `oauth_state` varchar(255);--> statement-breakpoint
UPDATE `user_sessions` SET `oauth_state` = NULL WHERE `oauth_state` = '';
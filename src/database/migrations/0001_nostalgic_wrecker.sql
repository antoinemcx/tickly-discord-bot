ALTER TABLE `user_sessions` ADD `last_used_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `session_retention_days` int;
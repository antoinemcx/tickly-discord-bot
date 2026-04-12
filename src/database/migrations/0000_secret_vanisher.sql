CREATE TABLE `languages` (
	`id` int NOT NULL,
	`code` enum('id','en-US','en-GB','bg','zh-CN','zh-TW','hr','cs','da','nl','fi','fr','de','el','hi','hu','it','ja','ko','lt','no','pl','pt-BR','ro','ru','es-ES','es-419','sv-SE','th','tr','uk','vi') NOT NULL,
	`name` varchar(20) NOT NULL,
	CONSTRAINT `languages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`status` enum('pending','completed') NOT NULL,
	`oauth_state` varchar(255) NOT NULL,
	`access_token` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_oauth_state_unique` UNIQUE(`oauth_state`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint NOT NULL,
	`preferred_language_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_preferred_language_id_languages_id_fk` FOREIGN KEY (`preferred_language_id`) REFERENCES `languages`(`id`) ON DELETE no action ON UPDATE no action;
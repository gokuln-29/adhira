CREATE TABLE `admin_password_resets` (
	`id` char(36) NOT NULL,
	`admin_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_pw_reset_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `admin_password_resets` ADD CONSTRAINT `admin_password_resets_admin_id_admin_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_pw_reset_admin_idx` ON `admin_password_resets` (`admin_id`);
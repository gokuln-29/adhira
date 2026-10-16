CREATE TABLE `slug_redirects` (
	`id` char(36) NOT NULL,
	`kind` varchar(10) NOT NULL,
	`old_slug` varchar(200) NOT NULL,
	`target_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `slug_redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug_redirects_kind_old_uq` UNIQUE(`kind`,`old_slug`)
);
--> statement-breakpoint
CREATE INDEX `slug_redirects_target_idx` ON `slug_redirects` (`kind`,`target_id`);
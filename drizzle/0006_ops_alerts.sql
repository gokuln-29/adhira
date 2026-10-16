CREATE TABLE `ops_alerts` (
	`id` char(36) NOT NULL,
	`kind` varchar(40) NOT NULL,
	`ref` varchar(120) NOT NULL,
	`severity` varchar(10) NOT NULL DEFAULT 'critical',
	`title` varchar(200) NOT NULL,
	`details` text,
	`order_number` varchar(40),
	`occurrences` int NOT NULL DEFAULT 1,
	`email_sent_at` datetime(3),
	`resolved_at` datetime(3),
	`resolved_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ops_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `ops_alerts_kind_ref_uq` UNIQUE(`kind`,`ref`)
);
--> statement-breakpoint
CREATE INDEX `ops_alerts_open_idx` ON `ops_alerts` (`resolved_at`);
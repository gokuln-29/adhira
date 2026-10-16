CREATE TABLE `delivery_blackouts` (
	`date` date NOT NULL,
	`note` varchar(200),
	CONSTRAINT `delivery_blackouts_date` PRIMARY KEY(`date`)
);
--> statement-breakpoint
CREATE TABLE `delivery_settings` (
	`id` int NOT NULL DEFAULT 1,
	`same_day_cutoff` char(5) NOT NULL DEFAULT '14:00',
	`same_day_min_prep_hours` int NOT NULL DEFAULT 3,
	`max_days_ahead` int NOT NULL DEFAULT 60,
	`closed_weekdays` json NOT NULL,
	`disabled_slots` json NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `delivery_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`emirate` varchar(30) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`fee` decimal(10,2) NOT NULL DEFAULT 0,
	`free_over` decimal(10,2),
	`same_day` boolean NOT NULL DEFAULT false,
	CONSTRAINT `delivery_zones_emirate` PRIMARY KEY(`emirate`)
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD `delivery_vat` decimal(10,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_vat` decimal(10,2) DEFAULT 0 NOT NULL;
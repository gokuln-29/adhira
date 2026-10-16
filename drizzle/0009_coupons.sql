CREATE TABLE `offer_redemptions` (
	`id` char(36) NOT NULL,
	`offer_id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`customer_email` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `offer_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `offer_redemptions_order_uq` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `offer_targets` (
	`offer_id` char(36) NOT NULL,
	`kind` varchar(10) NOT NULL,
	`target_id` char(36) NOT NULL,
	CONSTRAINT `offer_targets_uq` UNIQUE(`offer_id`,`kind`,`target_id`)
);
--> statement-breakpoint
ALTER TABLE `delivery_settings` MODIFY COLUMN `same_day_min_prep_hours` int NOT NULL DEFAULT 2;--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_total` decimal(10,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `coupon_code` varchar(40);--> statement-breakpoint
ALTER TABLE `offers` ADD `min_subtotal` decimal(10,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `max_uses` int;--> statement-breakpoint
ALTER TABLE `offers` ADD `max_uses_per_customer` int;--> statement-breakpoint
ALTER TABLE `order_items` ADD `discount` decimal(10,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_total` decimal(10,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `offer_id` char(36);--> statement-breakpoint
ALTER TABLE `offer_redemptions` ADD CONSTRAINT `offer_redemptions_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offer_redemptions` ADD CONSTRAINT `offer_redemptions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offer_targets` ADD CONSTRAINT `offer_targets_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `offer_redemptions_offer_idx` ON `offer_redemptions` (`offer_id`,`customer_email`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE set null ON UPDATE no action;
CREATE TABLE `invoice_counters` (
	`fy` varchar(7) NOT NULL,
	`last_seq` int NOT NULL DEFAULT 0,
	CONSTRAINT `invoice_counters_fy` PRIMARY KEY(`fy`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`number` varchar(30) NOT NULL,
	`fy` varchar(7) NOT NULL,
	`seq` int NOT NULL,
	`issued_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`seller` json NOT NULL,
	`buyer` json NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`vat` decimal(10,2) NOT NULL,
	`deposit_total` decimal(10,2) NOT NULL DEFAULT 0,
	`delivery_fee` decimal(10,2) NOT NULL DEFAULT 0,
	`total` decimal(10,2) NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'AED',
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_order_uq` UNIQUE(`order_id`),
	CONSTRAINT `invoices_number_uq` UNIQUE(`number`),
	CONSTRAINT `invoices_fy_seq_uq` UNIQUE(`fy`,`seq`)
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `name_ar` varchar(200);--> statement-breakpoint
ALTER TABLE `order_items` ADD `vat_rate` decimal(5,2) DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `vat` decimal(10,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `legal_name` varchar(200);--> statement-breakpoint
ALTER TABLE `store_settings` ADD `legal_name_ar` varchar(200);--> statement-breakpoint
ALTER TABLE `store_settings` ADD `address` varchar(500);--> statement-breakpoint
ALTER TABLE `store_settings` ADD `address_ar` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;
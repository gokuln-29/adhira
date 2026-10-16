CREATE TABLE `admin_sessions` (
	`id` char(36) NOT NULL,
	`admin_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`csrf_token` char(64) NOT NULL,
	`mfa_passed` boolean NOT NULL DEFAULT false,
	`ip` varchar(64),
	`user_agent` varchar(255),
	`expires_at` datetime(3) NOT NULL,
	`last_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_sessions_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(200) NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'staff',
	`password_hash` varchar(255) NOT NULL,
	`totp_secret` varchar(255),
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`recovery_codes` json,
	`failed_logins` int NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` char(36) NOT NULL,
	`title` varchar(300) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`cover` varchar(2000),
	`excerpt` text,
	`body` text,
	`category` varchar(100),
	`tags` json NOT NULL,
	`status` varchar(10) NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`seo_title` varchar(300),
	`seo_description` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`name_ar` varchar(200),
	`slug` varchar(200) NOT NULL,
	`image` varchar(2000),
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`id` char(36) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `customer_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_sessions_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(50),
	`company` varchar(200),
	`trn` varchar(30),
	`type` varchar(10) NOT NULL DEFAULT 'retail',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` char(36) NOT NULL,
	`company` varchar(200),
	`contact` varchar(200) NOT NULL,
	`email` varchar(255),
	`phone` varchar(50),
	`requirement` text,
	`frequency` varchar(50),
	`emirate` varchar(30),
	`budget` varchar(100),
	`message` text,
	`stage` varchar(12) NOT NULL DEFAULT 'new',
	`owner` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_uploads` (
	`id` char(36) NOT NULL,
	`staging_key` varchar(500) NOT NULL,
	`final_key` varchar(500),
	`purpose` varchar(20) NOT NULL,
	`declared_mime` varchar(50) NOT NULL,
	`declared_bytes` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`admin_id` char(36),
	`width` int,
	`height` int,
	`bytes` int,
	`checksum` char(64),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `media_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_uploads_staging_uq` UNIQUE(`staging_key`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` char(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`type` varchar(10) NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`code` varchar(100),
	`scope` varchar(20) NOT NULL DEFAULT 'all',
	`starts` datetime(3),
	`ends` datetime(3),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `offers_id` PRIMARY KEY(`id`),
	CONSTRAINT `offers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`product_id` char(36),
	`name` varchar(200) NOT NULL,
	`qty` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`line_total` decimal(10,2) NOT NULL,
	`vessel` boolean NOT NULL DEFAULT false,
	`vessel_fee` decimal(10,2) NOT NULL DEFAULT 0,
	`deposit` decimal(10,2) NOT NULL DEFAULT 0,
	`rental_months` int,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_items_qty_chk` CHECK(`order_items`.`qty` > 0)
);
--> statement-breakpoint
CREATE TABLE `order_status_events` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`kind` varchar(20) NOT NULL,
	`from_value` varchar(20),
	`to_value` varchar(20) NOT NULL,
	`actor` varchar(80) NOT NULL,
	`note` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `order_status_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` char(36) NOT NULL,
	`number` varchar(40) NOT NULL,
	`public_token` char(36) NOT NULL,
	`idempotency_key` varchar(100),
	`customer_id` char(36),
	`channel` varchar(10) NOT NULL DEFAULT 'retail',
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`payment_method` varchar(10) NOT NULL DEFAULT 'cod',
	`payment_status` varchar(10) NOT NULL DEFAULT 'unpaid',
	`subtotal` decimal(10,2) NOT NULL DEFAULT 0,
	`vat` decimal(10,2) NOT NULL DEFAULT 0,
	`delivery_fee` decimal(10,2) NOT NULL DEFAULT 0,
	`deposit_total` decimal(10,2) NOT NULL DEFAULT 0,
	`deposit_status` varchar(10) NOT NULL DEFAULT 'none',
	`total` decimal(10,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'AED',
	`emirate` varchar(30),
	`address` json NOT NULL,
	`delivery_date` date,
	`notes` text,
	`stripe_checkout_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`paid_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_uq` UNIQUE(`number`),
	CONSTRAINT `orders_public_token_uq` UNIQUE(`public_token`),
	CONSTRAINT `orders_idempotency_uq` UNIQUE(`idempotency_key`),
	CONSTRAINT `orders_stripe_session_uq` UNIQUE(`stripe_checkout_session_id`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`code_hash` char(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`consumed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_links` (
	`id` char(36) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`description` text,
	`customer_id` char(36),
	`status` varchar(10) NOT NULL DEFAULT 'pending',
	`provider_ref` varchar(255),
	`url` varchar(2000),
	`expires_at` datetime(3),
	`paid_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payment_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`url` varchar(2000) NOT NULL,
	`object_key` varchar(500),
	`alt` varchar(500) NOT NULL DEFAULT '',
	`position` int NOT NULL DEFAULT 0,
	`is_primary` boolean NOT NULL DEFAULT false,
	`width` int,
	`height` int,
	`mime_type` varchar(50),
	`bytes` int,
	`checksum` char(64),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` char(36) NOT NULL,
	`category_id` char(36),
	`name` varchar(200) NOT NULL,
	`name_ar` varchar(200),
	`slug` varchar(200) NOT NULL,
	`short_description` text,
	`short_description_ar` varchar(500),
	`details` json NOT NULL,
	`base_price` decimal(10,2) NOT NULL,
	`discount_type` varchar(10),
	`discount_value` decimal(10,2),
	`sale_start` datetime(3),
	`sale_end` datetime(3),
	`vat_rate` decimal(5,2) NOT NULL DEFAULT 5,
	`status` varchar(10) NOT NULL DEFAULT 'draft',
	`tags` json NOT NULL,
	`min_order_qty` int NOT NULL DEFAULT 1,
	`min_order_value` decimal(10,2) NOT NULL DEFAULT 0,
	`allows_vessel` boolean NOT NULL DEFAULT false,
	`vessel_price` decimal(10,2) NOT NULL DEFAULT 0,
	`vessel_deposit` decimal(10,2) NOT NULL DEFAULT 0,
	`is_rental` boolean NOT NULL DEFAULT false,
	`rental_monthly_price` decimal(10,2),
	`rental_min_months` int NOT NULL DEFAULT 1,
	`rental_deposit` decimal(10,2) NOT NULL DEFAULT 0,
	`stock_qty` int,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `products_price_chk` CHECK(`products`.`base_price` >= 0),
	CONSTRAINT `products_discount_chk` CHECK((`products`.`discount_type` IS NULL) = (`products`.`discount_value` IS NULL)),
	CONSTRAINT `products_min_qty_chk` CHECK(`products`.`min_order_qty` BETWEEN 1 AND 1000),
	CONSTRAINT `products_rental_chk` CHECK(NOT `products`.`is_rental` OR COALESCE(`products`.`rental_monthly_price`, 0) > 0),
	CONSTRAINT `products_rental_months_chk` CHECK(`products`.`rental_min_months` BETWEEN 1 AND 60),
	CONSTRAINT `products_stock_chk` CHECK(`products`.`stock_qty` IS NULL OR `products`.`stock_qty` >= 0)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` varchar(255) NOT NULL,
	`window_start` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`hits` int NOT NULL DEFAULT 0,
	CONSTRAINT `rate_limits_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` int NOT NULL DEFAULT 1,
	`whatsapp_number` varchar(15),
	`contact_phone` varchar(30),
	`contact_email` varchar(200),
	`trn` varchar(15),
	`hero_image_url` varchar(2000),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `store_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` varchar(100) NOT NULL,
	`type` varchar(100) NOT NULL,
	`outcome` varchar(200),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `stripe_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_admin_id_admin_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_sessions` ADD CONSTRAINT `customer_sessions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_owner_admin_users_id_fk` FOREIGN KEY (`owner`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_uploads` ADD CONSTRAINT `media_uploads_admin_id_admin_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_events` ADD CONSTRAINT `order_status_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_links` ADD CONSTRAINT `payment_links_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_sessions_admin_idx` ON `admin_sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `blog_posts_status_idx` ON `blog_posts` (`status`);--> statement-breakpoint
CREATE INDEX `customer_sessions_customer_idx` ON `customer_sessions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`);--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_status_events_order_idx` ON `order_status_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_customer_id_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_delivery_date_idx` ON `orders` (`delivery_date`);--> statement-breakpoint
CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `otp_codes_email_idx` ON `otp_codes` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_links_status_idx` ON `payment_links` (`status`);--> statement-breakpoint
CREATE INDEX `product_images_product_id_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE INDEX `products_is_rental_idx` ON `products` (`is_rental`);
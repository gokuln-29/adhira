-- At most one primary image per product (replaces the Postgres partial unique index).
ALTER TABLE `product_images`
  ADD COLUMN `primary_for` CHAR(36) GENERATED ALWAYS AS (IF(`is_primary`, `product_id`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX `product_images_one_primary_uq` (`primary_for`);
--> statement-breakpoint
ALTER TABLE `store_settings`
  ADD CONSTRAINT `store_settings_single_row_chk` CHECK (`id` = 1),
  ADD CONSTRAINT `store_settings_whatsapp_chk` CHECK (`whatsapp_number` IS NULL OR `whatsapp_number` REGEXP '^[0-9]{8,15}$'),
  ADD CONSTRAINT `store_settings_trn_chk` CHECK (`trn` IS NULL OR `trn` REGEXP '^[0-9]{15}$');
--> statement-breakpoint
INSERT INTO `store_settings` (`id`) VALUES (1);
--> statement-breakpoint
ALTER TABLE `admin_users`
  ADD CONSTRAINT `admin_users_role_chk` CHECK (`role` IN ('owner','manager','staff'));
--> statement-breakpoint
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_status_chk` CHECK (`status` IN ('pending','confirmed','preparing','dispatched','delivered','cancelled','refunded')),
  ADD CONSTRAINT `orders_payment_status_chk` CHECK (`payment_status` IN ('unpaid','paid','refunded')),
  ADD CONSTRAINT `orders_emirate_chk` CHECK (`emirate` IS NULL OR `emirate` IN ('Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'));
--> statement-breakpoint
-- The last owner can neither be deleted nor demoted (replaces protect_last_owner()).
CREATE TRIGGER `admin_users_protect_owner_upd` BEFORE UPDATE ON `admin_users`
FOR EACH ROW
BEGIN
  IF OLD.role = 'owner' AND NEW.role <> 'owner'
     AND NOT EXISTS (SELECT 1 FROM admin_users WHERE role = 'owner' AND id <> OLD.id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The last owner cannot be removed or demoted';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `admin_users_protect_owner_del` BEFORE DELETE ON `admin_users`
FOR EACH ROW
BEGIN
  IF OLD.role = 'owner'
     AND NOT EXISTS (SELECT 1 FROM admin_users WHERE role = 'owner' AND id <> OLD.id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The last owner cannot be removed or demoted';
  END IF;
END;

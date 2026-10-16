-- Defaults mirror what the storefront already promised: same-day in Dubai/Sharjah/Ajman
-- before 2 PM, all seven emirates served, three time windows. Fees start at 0 (free)
-- so nothing changes until the owner sets real fees in Admin > Delivery.
INSERT INTO `delivery_zones` (`emirate`, `enabled`, `fee`, `free_over`, `same_day`) VALUES
  ('Dubai', 1, 0, NULL, 1),
  ('Abu Dhabi', 1, 0, NULL, 0),
  ('Sharjah', 1, 0, NULL, 1),
  ('Ajman', 1, 0, NULL, 1),
  ('Ras Al Khaimah', 1, 0, NULL, 0),
  ('Fujairah', 1, 0, NULL, 0),
  ('Umm Al Quwain', 1, 0, NULL, 0);
--> statement-breakpoint
INSERT INTO `delivery_settings` (`id`, `same_day_cutoff`, `same_day_min_prep_hours`, `max_days_ahead`, `closed_weekdays`, `disabled_slots`)
VALUES (1, '14:00', 2, 60, JSON_ARRAY(), JSON_ARRAY());

-- Store-wide settings (single row) editable by the owner, plus Arabic content
-- columns for products and categories.

create table store_settings (
  id boolean primary key default true check (id),
  whatsapp_number text check (whatsapp_number ~ '^[0-9]{8,15}$'),
  contact_phone text check (char_length(contact_phone) <= 30),
  contact_email text check (char_length(contact_email) <= 200),
  trn text check (trn ~ '^[0-9]{15}$'),
  hero_image_url text check (char_length(hero_image_url) <= 2000),
  updated_at timestamptz not null default now()
);
insert into store_settings (id) values (true);

create trigger store_settings_set_updated_at before update on store_settings
  for each row execute function set_updated_at();

alter table store_settings enable row level security;
create policy "public read store_settings" on store_settings
  for select using (true);
create policy "owners update store_settings" on store_settings
  for update using (has_admin_role(array['owner'])) with check (has_admin_role(array['owner']));

-- Arabic content: shown on /ar when present, English otherwise.
alter table products
  add column name_ar text check (char_length(name_ar) <= 200),
  add column short_description_ar text check (char_length(short_description_ar) <= 500);
alter table categories
  add column name_ar text check (char_length(name_ar) <= 200);

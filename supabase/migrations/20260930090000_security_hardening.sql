-- Security hardening
--   1. Real admin roles (owner / manager / staff) enforced by RLS
--   2. Private, unguessable order lookup token
--   3. Postgres-backed rate limiter
--   4. Atomic order creation
--   5. Locked-down storage bucket and lead intake

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------
alter table admin_users drop constraint admin_users_role_check;
update admin_users set role = 'manager' where role = 'admin';
alter table admin_users
  add constraint admin_users_role_check check (role in ('owner', 'manager', 'staff')),
  alter column role set default 'staff';

-- Never leave the shop without an owner: promote the oldest account if needed.
update admin_users set role = 'owner'
where id = (select id from admin_users order by created_at limit 1)
  and not exists (select 1 from admin_users where role = 'owner');

create function admin_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from admin_users where auth_user_id = auth.uid() limit 1;
$$;

create function has_admin_role(roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(admin_role() = any (roles), false);
$$;

-- The last owner can neither be deleted nor demoted.
create function protect_last_owner()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from admin_users where role = 'owner' and id <> old.id) then
    raise exception 'The last owner cannot be removed or demoted';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger admin_users_protect_last_owner
  before update or delete on admin_users
  for each row execute function protect_last_owner();

-- admin_users: any admin can see the roster, only owners change it.
drop policy "admins read admin_users" on admin_users;
drop policy "admins manage admin_users" on admin_users;
create policy "admins read admin_users" on admin_users
  for select using (is_admin());
create policy "owners insert admin_users" on admin_users
  for insert with check (has_admin_role(array['owner']));
create policy "owners update admin_users" on admin_users
  for update using (has_admin_role(array['owner'])) with check (has_admin_role(array['owner']));
create policy "owners delete admin_users" on admin_users
  for delete using (has_admin_role(array['owner']));

-- Catalog, offers and blog: owner + manager.
drop policy "admins write categories" on categories;
drop policy "admins update categories" on categories;
drop policy "admins delete categories" on categories;
create policy "editors insert categories" on categories
  for insert with check (has_admin_role(array['owner', 'manager']));
create policy "editors update categories" on categories
  for update using (has_admin_role(array['owner', 'manager']))
  with check (has_admin_role(array['owner', 'manager']));
create policy "editors delete categories" on categories
  for delete using (has_admin_role(array['owner', 'manager']));

drop policy "admins insert products" on products;
drop policy "admins update products" on products;
drop policy "admins delete products" on products;
create policy "editors insert products" on products
  for insert with check (has_admin_role(array['owner', 'manager']));
create policy "editors update products" on products
  for update using (has_admin_role(array['owner', 'manager']))
  with check (has_admin_role(array['owner', 'manager']));
create policy "editors delete products" on products
  for delete using (has_admin_role(array['owner', 'manager']));

drop policy "admins insert product_images" on product_images;
drop policy "admins update product_images" on product_images;
drop policy "admins delete product_images" on product_images;
create policy "editors insert product_images" on product_images
  for insert with check (has_admin_role(array['owner', 'manager']));
create policy "editors update product_images" on product_images
  for update using (has_admin_role(array['owner', 'manager']))
  with check (has_admin_role(array['owner', 'manager']));
create policy "editors delete product_images" on product_images
  for delete using (has_admin_role(array['owner', 'manager']));

drop policy "admins insert offers" on offers;
drop policy "admins update offers" on offers;
drop policy "admins delete offers" on offers;
create policy "editors insert offers" on offers
  for insert with check (has_admin_role(array['owner', 'manager']));
create policy "editors update offers" on offers
  for update using (has_admin_role(array['owner', 'manager']))
  with check (has_admin_role(array['owner', 'manager']));
create policy "editors delete offers" on offers
  for delete using (has_admin_role(array['owner', 'manager']));

drop policy "admins insert blog_posts" on blog_posts;
drop policy "admins update blog_posts" on blog_posts;
drop policy "admins delete blog_posts" on blog_posts;
create policy "editors insert blog_posts" on blog_posts
  for insert with check (has_admin_role(array['owner', 'manager']));
create policy "editors update blog_posts" on blog_posts
  for update using (has_admin_role(array['owner', 'manager']))
  with check (has_admin_role(array['owner', 'manager']));
create policy "editors delete blog_posts" on blog_posts
  for delete using (has_admin_role(array['owner', 'manager']));

-- Orders, customers, leads: every admin works them; only owners delete.
drop policy "admins manage orders" on orders;
create policy "admins read orders" on orders
  for select using (is_admin());
create policy "admins update orders" on orders
  for update using (is_admin()) with check (is_admin());
create policy "owners delete orders" on orders
  for delete using (has_admin_role(array['owner']));

drop policy "admins manage order_items" on order_items;
create policy "admins read order_items" on order_items
  for select using (is_admin());
create policy "owners delete order_items" on order_items
  for delete using (has_admin_role(array['owner']));

drop policy "admins delete customers" on customers;
create policy "owners delete customers" on customers
  for delete using (has_admin_role(array['owner']));

drop policy "admins delete leads" on leads;
create policy "editors delete leads" on leads
  for delete using (has_admin_role(array['owner', 'manager']));

-- Payment links create real Stripe objects: owner only.
drop policy "admins manage payment_links" on payment_links;
create policy "owners manage payment_links" on payment_links
  for all using (has_admin_role(array['owner'])) with check (has_admin_role(array['owner']));

-- ---------------------------------------------------------------------------
-- 5. Lead intake goes through a validated, rate-limited server action that
--    uses the service role, so the public REST API can no longer be used to
--    flood the table directly.
-- ---------------------------------------------------------------------------
drop policy "public submit leads" on leads;

-- Storage: only images, capped at 5 MB, editors only.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'product-images';

drop policy "admins upload product-images" on storage.objects;
drop policy "admins update product-images" on storage.objects;
drop policy "admins delete product-images" on storage.objects;
create policy "editors upload product-images" on storage.objects
  for insert with check (bucket_id = 'product-images' and has_admin_role(array['owner', 'manager']));
create policy "editors update product-images" on storage.objects
  for update using (bucket_id = 'product-images' and has_admin_role(array['owner', 'manager']))
  with check (bucket_id = 'product-images' and has_admin_role(array['owner', 'manager']));
create policy "editors delete product-images" on storage.objects
  for delete using (bucket_id = 'product-images' and has_admin_role(array['owner', 'manager']));

-- ---------------------------------------------------------------------------
-- 2. Private order lookup token (order numbers are guessable, this is not)
-- ---------------------------------------------------------------------------
alter table orders
  add column public_token uuid not null default gen_random_uuid() unique;

-- ---------------------------------------------------------------------------
-- 3. Rate limiter (service role only: RLS on, no policies)
-- ---------------------------------------------------------------------------
create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table rate_limits enable row level security;

create function hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.hits + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Atomic order creation. The caller (server code) prices the lines from the
--    products table; this function only persists them in ONE transaction.
-- ---------------------------------------------------------------------------
create function create_order_tx(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_number text;
  v_token uuid;
  v_email text := btrim(p #>> '{customer,email}');
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_suffix text;
  v_attempt integer := 0;
begin
  select id into v_customer_id from customers where lower(email) = lower(v_email);
  if v_customer_id is null then
    insert into customers (name, email, phone, company, trn, type)
    values (
      btrim(p #>> '{customer,name}'),
      v_email,
      nullif(btrim(p #>> '{customer,phone}'), ''),
      nullif(btrim(p #>> '{customer,company}'), ''),
      nullif(btrim(p #>> '{customer,trn}'), ''),
      case when nullif(btrim(p #>> '{customer,company}'), '') is null then 'retail' else 'corporate' end
    )
    on conflict ((lower(email))) do nothing
    returning id into v_customer_id;
    if v_customer_id is null then
      select id into v_customer_id from customers where lower(email) = lower(v_email);
    end if;
  end if;

  loop
    v_suffix := '';
    for i in 1..6 loop
      v_suffix := v_suffix || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    v_number := 'FN-' || to_char(now() at time zone 'Asia/Dubai', 'YYMMDD') || '-' || v_suffix;
    begin
      insert into orders (
        number, customer_id, channel, status, subtotal, vat, delivery_fee, total,
        currency, emirate, address, delivery_date, notes
      ) values (
        v_number, v_customer_id, p ->> 'channel', 'pending',
        (p ->> 'subtotal')::numeric, (p ->> 'vat')::numeric,
        (p ->> 'delivery_fee')::numeric, (p ->> 'total')::numeric,
        'AED', p ->> 'emirate', coalesce(p -> 'address', '{}'::jsonb),
        nullif(p ->> 'delivery_date', '')::date, nullif(p ->> 'notes', '')
      )
      returning id, public_token into v_order_id, v_token;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then raise; end if;
    end;
  end loop;

  insert into order_items (order_id, product_id, name, qty, unit_price, line_total)
  select
    v_order_id,
    (i ->> 'product_id')::uuid,
    i ->> 'name',
    (i ->> 'qty')::integer,
    (i ->> 'unit_price')::numeric,
    (i ->> 'line_total')::numeric
  from jsonb_array_elements(p -> 'items') as i;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'public_token', v_token);
end;
$$;

-- Only server code holding the service-role key may call these.
revoke all on function create_order_tx(jsonb) from public, anon, authenticated;
revoke all on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function create_order_tx(jsonb) to service_role;
grant execute on function hit_rate_limit(text, integer, integer) to service_role;

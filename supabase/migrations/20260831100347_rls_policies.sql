-- Flowers & Gifts: row-level security
-- security definer so the policy check itself isn't blocked by RLS on admin_users
create function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_users where auth_user_id = auth.uid()
  );
$$;

alter table admin_users enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table offers enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table leads enable row level security;
alter table blog_posts enable row level security;
alter table payment_links enable row level security;

-- admin_users: admins can see the roster; only admins manage it.
create policy "admins read admin_users" on admin_users
  for select using (is_admin());
create policy "admins manage admin_users" on admin_users
  for all using (is_admin()) with check (is_admin());

-- categories: public catalog read, admin write.
create policy "public read categories" on categories
  for select using (true);
create policy "admins write categories" on categories
  for insert with check (is_admin());
create policy "admins update categories" on categories
  for update using (is_admin()) with check (is_admin());
create policy "admins delete categories" on categories
  for delete using (is_admin());

-- products: public sees only published products, admins see/manage everything.
create policy "public read active products" on products
  for select using (status = 'active' or is_admin());
create policy "admins insert products" on products
  for insert with check (is_admin());
create policy "admins update products" on products
  for update using (is_admin()) with check (is_admin());
create policy "admins delete products" on products
  for delete using (is_admin());

-- product_images: readable wherever the parent product is readable.
create policy "read images of visible products" on product_images
  for select using (
    is_admin() or exists (
      select 1 from products
      where products.id = product_images.product_id and products.status = 'active'
    )
  );
create policy "admins insert product_images" on product_images
  for insert with check (is_admin());
create policy "admins update product_images" on product_images
  for update using (is_admin()) with check (is_admin());
create policy "admins delete product_images" on product_images
  for delete using (is_admin());

-- offers: public sees only active offers within their window.
create policy "public read active offers" on offers
  for select using (
    is_admin() or (
      active
      and (starts is null or starts <= now())
      and (ends is null or ends >= now())
    )
  );
create policy "admins insert offers" on offers
  for insert with check (is_admin());
create policy "admins update offers" on offers
  for update using (is_admin()) with check (is_admin());
create policy "admins delete offers" on offers
  for delete using (is_admin());

-- customers: a signed-in customer manages only their own record; admins manage all.
create policy "customers read own record" on customers
  for select using (is_admin() or auth_user_id = auth.uid());
create policy "customers insert own record" on customers
  for insert with check (auth_user_id = auth.uid());
create policy "customers update own record" on customers
  for update using (is_admin() or auth_user_id = auth.uid())
  with check (is_admin() or auth_user_id = auth.uid());
create policy "admins delete customers" on customers
  for delete using (is_admin());

-- orders/order_items: customers read their own; all writes go through the
-- service-role client from checkout/webhook server code, so there is no
-- public insert/update policy here by design.
create policy "customers read own orders" on orders
  for select using (
    is_admin() or exists (
      select 1 from customers
      where customers.id = orders.customer_id and customers.auth_user_id = auth.uid()
    )
  );
create policy "admins manage orders" on orders
  for all using (is_admin()) with check (is_admin());

create policy "customers read own order_items" on order_items
  for select using (
    is_admin() or exists (
      select 1 from orders
      join customers on customers.id = orders.customer_id
      where orders.id = order_items.order_id and customers.auth_user_id = auth.uid()
    )
  );
create policy "admins manage order_items" on order_items
  for all using (is_admin()) with check (is_admin());

-- leads: anyone can submit a storefront enquiry; only admins can read/manage the pipeline.
create policy "public submit leads" on leads
  for insert with check (true);
create policy "admins read leads" on leads
  for select using (is_admin());
create policy "admins update leads" on leads
  for update using (is_admin()) with check (is_admin());
create policy "admins delete leads" on leads
  for delete using (is_admin());

-- blog_posts: public sees only published posts.
create policy "public read published posts" on blog_posts
  for select using (status = 'published' or is_admin());
create policy "admins insert blog_posts" on blog_posts
  for insert with check (is_admin());
create policy "admins update blog_posts" on blog_posts
  for update using (is_admin()) with check (is_admin());
create policy "admins delete blog_posts" on blog_posts
  for delete using (is_admin());

-- payment_links: admin/back-office only; created and reconciled server-side.
create policy "admins manage payment_links" on payment_links
  for all using (is_admin()) with check (is_admin());

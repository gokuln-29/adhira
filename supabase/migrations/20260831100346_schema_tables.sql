-- Flowers & Gifts: core schema
create extension if not exists pgcrypto;

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin/staff, referenced by RLS policies in the next migration.
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_set_updated_at before update on categories
  for each row execute function set_updated_at();

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  details jsonb not null default '[]'::jsonb, -- array of {label, value}
  base_price numeric(10, 2) not null check (base_price >= 0),
  discount_type text check (discount_type in ('percent', 'flat')),
  discount_value numeric(10, 2) check (discount_value >= 0),
  sale_start timestamptz,
  sale_end timestamptz,
  vat_rate numeric(5, 2) not null default 5,
  status text not null default 'draft' check (status in ('draft', 'active')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_requires_value check (
    (discount_type is null) = (discount_value is null)
  )
);
create index products_category_id_idx on products (category_id);
create index products_status_idx on products (status);
create index products_tags_idx on products using gin (tags);
create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  url text not null,
  alt text not null default '',
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on product_images (product_id);
-- At most one primary image per product.
create unique index product_images_one_primary_idx on product_images (product_id)
  where is_primary;

create table offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('percent', 'flat', 'code')),
  value numeric(10, 2) not null check (value >= 0),
  code text unique,
  scope text not null default 'all' check (scope in ('all', 'category', 'product')),
  starts timestamptz,
  ends timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger offers_set_updated_at before update on offers
  for each row execute function set_updated_at();

create table customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  company text,
  trn text,
  type text not null default 'retail' check (type in ('retail', 'corporate')),
  created_at timestamptz not null default now()
);
create unique index customers_email_idx on customers (lower(email));

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid references customers (id) on delete set null,
  channel text not null default 'retail' check (channel in ('retail', 'corporate')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')),
  subtotal numeric(10, 2) not null default 0,
  vat numeric(10, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  currency text not null default 'AED',
  emirate text check (emirate in ('Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain')),
  address jsonb not null default '{}'::jsonb,
  delivery_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_id_idx on orders (customer_id);
create index orders_status_idx on orders (status);
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  line_total numeric(10, 2) not null check (line_total >= 0)
);
create index order_items_order_id_idx on order_items (order_id);

create table leads (
  id uuid primary key default gen_random_uuid(),
  company text,
  contact text not null,
  email text,
  phone text,
  requirement text,
  frequency text,
  emirate text,
  budget text,
  message text,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'quoted', 'won', 'lost')),
  owner uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_stage_idx on leads (stage);
create trigger leads_set_updated_at before update on leads
  for each row execute function set_updated_at();

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  cover text,
  excerpt text,
  body text,
  category text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_status_idx on blog_posts (status);
create trigger blog_posts_set_updated_at before update on blog_posts
  for each row execute function set_updated_at();

create table payment_links (
  id uuid primary key default gen_random_uuid(),
  amount numeric(10, 2) not null check (amount >= 0),
  description text,
  customer_id uuid references customers (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  provider_ref text,
  url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_links_status_idx on payment_links (status);

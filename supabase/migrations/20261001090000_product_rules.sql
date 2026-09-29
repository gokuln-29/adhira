-- Product rules: minimum order, glass vessel (with refundable deposit) and
-- rental plants. All admin-editable per product.

alter table products
  add column min_order_qty integer not null default 1 check (min_order_qty >= 1 and min_order_qty <= 1000),
  add column min_order_value numeric(10, 2) not null default 0 check (min_order_value >= 0),
  add column allows_vessel boolean not null default false,
  add column vessel_price numeric(10, 2) not null default 0 check (vessel_price >= 0),
  add column vessel_deposit numeric(10, 2) not null default 0 check (vessel_deposit >= 0),
  add column is_rental boolean not null default false,
  add column rental_monthly_price numeric(10, 2) check (rental_monthly_price >= 0),
  add column rental_min_months integer not null default 1 check (rental_min_months between 1 and 60),
  add column rental_deposit numeric(10, 2) not null default 0 check (rental_deposit >= 0),
  add constraint rental_requires_price check (not is_rental or coalesce(rental_monthly_price, 0) > 0);

create index products_is_rental_idx on products (is_rental) where is_rental;

-- What the customer chose, snapshotted on each order line.
alter table order_items
  add column vessel boolean not null default false,
  add column vessel_fee numeric(10, 2) not null default 0,
  add column deposit numeric(10, 2) not null default 0,
  add column rental_months integer check (rental_months between 1 and 60);

-- Refundable deposits are held outside `total`'s VAT base and tracked here.
alter table orders
  add column deposit_total numeric(10, 2) not null default 0,
  add column deposit_status text not null default 'none'
    check (deposit_status in ('none', 'held', 'refunded'));

create or replace function create_order_tx(p jsonb)
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
  v_deposit numeric := coalesce((p ->> 'deposit_total')::numeric, 0);
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
        currency, emirate, address, delivery_date, notes, deposit_total, deposit_status
      ) values (
        v_number, v_customer_id, p ->> 'channel', 'pending',
        (p ->> 'subtotal')::numeric, (p ->> 'vat')::numeric,
        (p ->> 'delivery_fee')::numeric, (p ->> 'total')::numeric,
        'AED', p ->> 'emirate', coalesce(p -> 'address', '{}'::jsonb),
        nullif(p ->> 'delivery_date', '')::date, nullif(p ->> 'notes', ''),
        v_deposit, case when v_deposit > 0 then 'held' else 'none' end
      )
      returning id, public_token into v_order_id, v_token;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then raise; end if;
    end;
  end loop;

  insert into order_items (
    order_id, product_id, name, qty, unit_price, line_total,
    vessel, vessel_fee, deposit, rental_months
  )
  select
    v_order_id,
    (i ->> 'product_id')::uuid,
    i ->> 'name',
    (i ->> 'qty')::integer,
    (i ->> 'unit_price')::numeric,
    (i ->> 'line_total')::numeric,
    coalesce((i ->> 'vessel')::boolean, false),
    coalesce((i ->> 'vessel_fee')::numeric, 0),
    coalesce((i ->> 'deposit')::numeric, 0),
    nullif(i ->> 'rental_months', '')::integer
  from jsonb_array_elements(p -> 'items') as i;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'public_token', v_token);
end;
$$;

revoke all on function create_order_tx(jsonb) from public, anon, authenticated;
grant execute on function create_order_tx(jsonb) to service_role;

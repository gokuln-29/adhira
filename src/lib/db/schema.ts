import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  customType,
  date,
  decimal,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Column names stay snake_case and identical to the old Postgres schema so the
// rows the data layer returns keep the exact shape the UI already consumes.

/** UUID stored as CHAR(36); generated application-side. */
export const uuid = (name: string) => char(name, { length: 36 });

/** DECIMAL(10,2) surfaced as a JS number (the code already did Number(...)). */
export const money = (name: string) =>
  decimal(name, { precision: 10, scale: 2, mode: "number" });

/**
 * UTC DATETIME(3) surfaced as an ISO-8601 string ("2026-10-16T09:30:00.000Z"),
 * which is what PostgREST returned and what the UI formats. Accepts Date or ISO.
 */
export const ts = customType<{ data: string; driverData: string }>({
  dataType: () => "datetime(3)",
  toDriver: (v) => toMysqlDatetime(v),
  fromDriver: (v) => fromMysqlDatetime(v as unknown as string | Date),
});

export function toMysqlDatetime(v: string | Date): string {
  const d = v instanceof Date ? v : new Date(v);
  return d.toISOString().replace("T", " ").replace("Z", "");
}

function fromMysqlDatetime(v: string | Date): string {
  if (v instanceof Date) return v.toISOString();
  return `${v.replace(" ", "T")}${v.length === 19 ? ".000" : ""}Z`;
}

const createdAt = () => ts("created_at").notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdateFn(() => new Date().toISOString());

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const admin_users = mysqlTable(
  "admin_users",
  {
    id: uuid("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    role: varchar("role", { length: 20 }).$type<"owner" | "manager" | "staff">().notNull().default("staff"),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    totp_secret: varchar("totp_secret", { length: 255 }),
    totp_enabled: boolean("totp_enabled").notNull().default(false),
    // Last accepted TOTP time-step; codes at or before it are rejected (replay).
    totp_last_step: int("totp_last_step"),
    // Hashed one-time recovery codes (JSON string[]).
    recovery_codes: json("recovery_codes").$type<string[]>(),
    failed_logins: int("failed_logins").notNull().default(0),
    locked_until: ts("locked_until"),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("admin_users_email_uq").on(t.email)],
);

// Server-side sessions: the cookie holds a random token, the DB holds its hash.
export const admin_sessions = mysqlTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey(),
    admin_id: uuid("admin_id").notNull().references(() => admin_users.id, { onDelete: "cascade" }),
    token_hash: char("token_hash", { length: 64 }).notNull(),
    // false until the TOTP step passes (for accounts with MFA enabled).
    mfa_passed: boolean("mfa_passed").notNull().default(false),
    ip: varchar("ip", { length: 64 }),
    user_agent: varchar("user_agent", { length: 255 }),
    expires_at: ts("expires_at").notNull(),
    last_seen_at: ts("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("admin_sessions_token_uq").on(t.token_hash), index("admin_sessions_admin_idx").on(t.admin_id)],
);

export const customer_sessions = mysqlTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey(),
    customer_id: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    token_hash: char("token_hash", { length: 64 }).notNull(),
    expires_at: ts("expires_at").notNull(),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("customer_sessions_token_uq").on(t.token_hash), index("customer_sessions_customer_idx").on(t.customer_id)],
);

// Email one-time codes for customer sign-in. Only a hash of the code is stored.
export const otp_codes = mysqlTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    code_hash: char("code_hash", { length: 64 }).notNull(),
    attempts: int("attempts").notNull().default(0),
    expires_at: ts("expires_at").notNull(),
    consumed_at: ts("consumed_at"),
    created_at: createdAt(),
  },
  (t) => [index("otp_codes_email_idx").on(t.email, t.created_at)],
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const categories = mysqlTable(
  "categories",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    name_ar: varchar("name_ar", { length: 200 }),
    slug: varchar("slug", { length: 200 }).notNull(),
    image: varchar("image", { length: 2000 }),
    position: int("position").notNull().default(0),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

export const products = mysqlTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    category_id: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    name_ar: varchar("name_ar", { length: 200 }),
    slug: varchar("slug", { length: 200 }).notNull(),
    short_description: text("short_description"),
    short_description_ar: varchar("short_description_ar", { length: 500 }),
    details: json("details").$type<{ label: string; value: string }[]>().notNull(),
    base_price: money("base_price").notNull(),
    discount_type: varchar("discount_type", { length: 10 }).$type<"percent" | "flat">(),
    discount_value: money("discount_value"),
    sale_start: ts("sale_start"),
    sale_end: ts("sale_end"),
    vat_rate: decimal("vat_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(5),
    status: varchar("status", { length: 10 }).$type<"draft" | "active">().notNull().default("draft"),
    tags: json("tags").$type<string[]>().notNull(),
    min_order_qty: int("min_order_qty").notNull().default(1),
    min_order_value: money("min_order_value").notNull().default(0),
    allows_vessel: boolean("allows_vessel").notNull().default(false),
    vessel_price: money("vessel_price").notNull().default(0),
    vessel_deposit: money("vessel_deposit").notNull().default(0),
    is_rental: boolean("is_rental").notNull().default(false),
    rental_monthly_price: money("rental_monthly_price"),
    rental_min_months: int("rental_min_months").notNull().default(1),
    rental_deposit: money("rental_deposit").notNull().default(0),
    // NULL = stock not tracked (always sellable). Otherwise decremented at checkout.
    stock_qty: int("stock_qty"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_category_id_idx").on(t.category_id),
    index("products_status_idx").on(t.status),
    index("products_is_rental_idx").on(t.is_rental),
    check("products_price_chk", sql`${t.base_price} >= 0`),
    check("products_discount_chk", sql`(${t.discount_type} IS NULL) = (${t.discount_value} IS NULL)`),
    check("products_min_qty_chk", sql`${t.min_order_qty} BETWEEN 1 AND 1000`),
    check("products_rental_chk", sql`NOT ${t.is_rental} OR COALESCE(${t.rental_monthly_price}, 0) > 0`),
    check("products_rental_months_chk", sql`${t.rental_min_months} BETWEEN 1 AND 60`),
    check("products_stock_chk", sql`${t.stock_qty} IS NULL OR ${t.stock_qty} >= 0`),
  ],
);

export const product_images = mysqlTable(
  "product_images",
  {
    id: uuid("id").primaryKey(),
    product_id: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    // Public URL on the media domain, derived from object_key (kept for the UI).
    url: varchar("url", { length: 2000 }).notNull(),
    // Canonical identity: the R2 object key, e.g. products/<uuid>/<uuid>.webp
    object_key: varchar("object_key", { length: 500 }),
    alt: varchar("alt", { length: 500 }).notNull().default(""),
    position: int("position").notNull().default(0),
    is_primary: boolean("is_primary").notNull().default(false),
    width: int("width"),
    height: int("height"),
    mime_type: varchar("mime_type", { length: 50 }),
    bytes: int("bytes"),
    checksum: char("checksum", { length: 64 }),
    created_at: createdAt(),
  },
  (t) => [index("product_images_product_id_idx").on(t.product_id)],
);

// One row per R2 upload, tracked from "intent" through processing, so abandoned
// or failed uploads can be quarantined and cleaned up.
export const media_uploads = mysqlTable(
  "media_uploads",
  {
    id: uuid("id").primaryKey(),
    staging_key: varchar("staging_key", { length: 500 }).notNull(),
    final_key: varchar("final_key", { length: 500 }),
    purpose: varchar("purpose", { length: 20 }).$type<"product" | "category" | "hero" | "blog">().notNull(),
    declared_mime: varchar("declared_mime", { length: 50 }).notNull(),
    declared_bytes: int("declared_bytes").notNull(),
    status: varchar("status", { length: 20 })
      .$type<"pending" | "processed" | "rejected" | "expired">()
      .notNull()
      .default("pending"),
    admin_id: uuid("admin_id").references(() => admin_users.id, { onDelete: "set null" }),
    width: int("width"),
    height: int("height"),
    bytes: int("bytes"),
    checksum: char("checksum", { length: 64 }),
    created_at: createdAt(),
    expires_at: ts("expires_at").notNull(),
  },
  (t) => [uniqueIndex("media_uploads_staging_uq").on(t.staging_key)],
);

export const offers = mysqlTable("offers", {
  id: uuid("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  type: varchar("type", { length: 10 }).$type<"percent" | "flat" | "code">().notNull(),
  value: money("value").notNull(),
  code: varchar("code", { length: 100 }).unique(),
  scope: varchar("scope", { length: 20 }).notNull().default("all"),
  starts: ts("starts"),
  ends: ts("ends"),
  active: boolean("active").notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const blog_posts = mysqlTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey(),
    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    cover: varchar("cover", { length: 2000 }),
    excerpt: text("excerpt"),
    body: text("body"),
    category: varchar("category", { length: 100 }),
    tags: json("tags").$type<string[]>().notNull(),
    status: varchar("status", { length: 10 }).$type<"draft" | "published">().notNull().default("draft"),
    published_at: ts("published_at"),
    seo_title: varchar("seo_title", { length: 300 }),
    seo_description: varchar("seo_description", { length: 500 }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [uniqueIndex("blog_posts_slug_uq").on(t.slug), index("blog_posts_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// Customers, orders
// ---------------------------------------------------------------------------

export const customers = mysqlTable(
  "customers",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    // utf8mb4_0900_ai_ci is case-insensitive, so this unique index is the
    // equivalent of the old unique(lower(email)).
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    company: varchar("company", { length: 200 }),
    trn: varchar("trn", { length: 30 }),
    type: varchar("type", { length: 10 }).$type<"retail" | "corporate">().notNull().default("retail"),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("customers_email_uq").on(t.email)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: uuid("id").primaryKey(),
    number: varchar("number", { length: 40 }).notNull(),
    public_token: uuid("public_token").notNull(),
    // Client-supplied key; a repeat submit returns the same order.
    idempotency_key: varchar("idempotency_key", { length: 100 }),
    customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    channel: varchar("channel", { length: 10 }).$type<"retail" | "corporate">().notNull().default("retail"),
    status: varchar("status", { length: 20 })
      .$type<"pending" | "confirmed" | "preparing" | "dispatched" | "delivered" | "cancelled" | "refunded">()
      .notNull()
      .default("pending"),
    // Money state is separate from fulfilment so COD is never auto-"paid".
    payment_method: varchar("payment_method", { length: 10 }).$type<"card" | "link" | "cod">().notNull().default("card"),
    payment_status: varchar("payment_status", { length: 10 })
      .$type<"unpaid" | "paid" | "refunded">()
      .notNull()
      .default("unpaid"),
    subtotal: money("subtotal").notNull().default(0),
    vat: money("vat").notNull().default(0),
    delivery_fee: money("delivery_fee").notNull().default(0),
    deposit_total: money("deposit_total").notNull().default(0),
    deposit_status: varchar("deposit_status", { length: 10 })
      .$type<"none" | "held" | "refunded">()
      .notNull()
      .default("none"),
    total: money("total").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull().default("AED"),
    emirate: varchar("emirate", { length: 30 }),
    address: json("address").$type<Record<string, unknown>>().notNull(),
    delivery_date: date("delivery_date", { mode: "string" }),
    notes: text("notes"),
    stripe_checkout_session_id: varchar("stripe_checkout_session_id", { length: 255 }),
    stripe_payment_intent_id: varchar("stripe_payment_intent_id", { length: 255 }),
    paid_at: ts("paid_at"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.number),
    uniqueIndex("orders_public_token_uq").on(t.public_token),
    uniqueIndex("orders_idempotency_uq").on(t.idempotency_key),
    uniqueIndex("orders_stripe_session_uq").on(t.stripe_checkout_session_id),
    index("orders_customer_id_idx").on(t.customer_id),
    index("orders_status_idx").on(t.status),
    index("orders_delivery_date_idx").on(t.delivery_date),
    index("orders_created_at_idx").on(t.created_at),
  ],
);

export const order_items = mysqlTable(
  "order_items",
  {
    id: uuid("id").primaryKey(),
    order_id: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    product_id: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    // Snapshots, so later catalogue edits never rewrite a purchase.
    name: varchar("name", { length: 200 }).notNull(),
    qty: int("qty").notNull(),
    unit_price: money("unit_price").notNull(),
    line_total: money("line_total").notNull(),
    vessel: boolean("vessel").notNull().default(false),
    vessel_fee: money("vessel_fee").notNull().default(0),
    deposit: money("deposit").notNull().default(0),
    rental_months: int("rental_months"),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.order_id),
    check("order_items_qty_chk", sql`${t.qty} > 0`),
  ],
);

// Immutable audit trail of every status change.
export const order_status_events = mysqlTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey(),
    order_id: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).$type<"status" | "payment" | "deposit">().notNull(),
    from_value: varchar("from_value", { length: 20 }),
    to_value: varchar("to_value", { length: 20 }).notNull(),
    // 'admin:<id>' | 'stripe' | 'system' | 'customer'
    actor: varchar("actor", { length: 80 }).notNull(),
    note: varchar("note", { length: 500 }),
    created_at: createdAt(),
  },
  (t) => [index("order_status_events_order_idx").on(t.order_id, t.created_at)],
);

// Stripe event ids already processed (webhook dedupe).
export const stripe_events = mysqlTable("stripe_events", {
  id: varchar("id", { length: 100 }).primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  outcome: varchar("outcome", { length: 200 }),
  created_at: createdAt(),
});

export const leads = mysqlTable(
  "leads",
  {
    id: uuid("id").primaryKey(),
    company: varchar("company", { length: 200 }),
    contact: varchar("contact", { length: 200 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    requirement: text("requirement"),
    frequency: varchar("frequency", { length: 50 }),
    emirate: varchar("emirate", { length: 30 }),
    budget: varchar("budget", { length: 100 }),
    message: text("message"),
    stage: varchar("stage", { length: 12 })
      .$type<"new" | "contacted" | "quoted" | "won" | "lost">()
      .notNull()
      .default("new"),
    owner: uuid("owner").references(() => admin_users.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("leads_stage_idx").on(t.stage)],
);

export const payment_links = mysqlTable(
  "payment_links",
  {
    id: uuid("id").primaryKey(),
    amount: money("amount").notNull(),
    description: text("description"),
    customer_id: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: varchar("status", { length: 10 }).$type<"pending" | "paid" | "expired">().notNull().default("pending"),
    provider_ref: varchar("provider_ref", { length: 255 }),
    url: varchar("url", { length: 2000 }),
    expires_at: ts("expires_at"),
    paid_at: ts("paid_at"),
    created_at: createdAt(),
  },
  (t) => [index("payment_links_status_idx").on(t.status)],
);

// Single-row store settings (id is always 1).
export const store_settings = mysqlTable("store_settings", {
  id: int("id").primaryKey().default(1),
  whatsapp_number: varchar("whatsapp_number", { length: 15 }),
  contact_phone: varchar("contact_phone", { length: 30 }),
  contact_email: varchar("contact_email", { length: 200 }),
  trn: varchar("trn", { length: 15 }),
  hero_image_url: varchar("hero_image_url", { length: 2000 }),
  updated_at: updatedAt(),
});

export const rate_limits = mysqlTable("rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  window_start: ts("window_start").notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  hits: int("hits").notNull().default(0),
});

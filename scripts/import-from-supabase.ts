// One-off: copy the data from the old Supabase Postgres into MySQL.
//   SUPABASE_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres \
//   DATABASE_MIGRATE_URL=mysql://root:...@127.0.0.1:3307/adhira \
//   npx tsx scripts/import-from-supabase.ts [--wipe]
//
// - Preserves primary keys, order numbers and public tokens.
// - Maps order statuses to the new state machine (paid -> confirmed + payment paid, ...).
// - Does NOT copy admin accounts: passwords can't move between hash schemes.
//   Create admins with `npm run admin:create`.
// - Image URLs are copied as-is; `scripts/migrate-images-to-r2.ts` moves the files
//   and rewrites the URLs afterwards.
import "./_env";
import { Client } from "pg";
import mysql from "mysql2/promise";

const STATUS_MAP: Record<string, { status: string; payment: "unpaid" | "paid" | "refunded" }> = {
  pending: { status: "pending", payment: "unpaid" },
  paid: { status: "confirmed", payment: "paid" },
  processing: { status: "preparing", payment: "unpaid" },
  out_for_delivery: { status: "dispatched", payment: "unpaid" },
  delivered: { status: "delivered", payment: "unpaid" },
  cancelled: { status: "cancelled", payment: "unpaid" },
  refunded: { status: "refunded", payment: "refunded" },
};

const dt = (v: unknown): string | null =>
  v == null ? null : new Date(v as string | Date).toISOString().replace("T", " ").replace("Z", "");
const json = (v: unknown) => (v == null ? null : JSON.stringify(v));

async function main() {
  const pgUrl = process.env.SUPABASE_DB_URL;
  const myUrl = process.env.DATABASE_MIGRATE_URL;
  if (!pgUrl || !myUrl) throw new Error("Set SUPABASE_DB_URL and DATABASE_MIGRATE_URL");

  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();
  const my = await mysql.createConnection({ uri: myUrl, timezone: "Z" });
  const q = async (sql: string) => (await pg.query(sql)).rows as Record<string, any>[];

  const counts: Record<string, number> = {};
  const insertAll = async (table: string, rows: Record<string, unknown>[]) => {
    counts[table] = rows.length;
    for (const r of rows) {
      const cols = Object.keys(r);
      await my.query(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
        cols.map((c) => r[c]),
      );
    }
  };

  if (process.argv.includes("--wipe")) {
    await my.query("SET FOREIGN_KEY_CHECKS=0");
    for (const t of ["order_status_events", "order_items", "orders", "payment_links", "product_images", "products", "categories", "offers", "leads", "blog_posts", "customers"]) {
      await my.query(`DELETE FROM \`${t}\``);
    }
    await my.query("SET FOREIGN_KEY_CHECKS=1");
  }

  await my.beginTransaction();
  try {
    await insertAll("categories", (await q("select * from categories")).map((r) => ({
      id: r.id, name: r.name, name_ar: r.name_ar, slug: r.slug, image: r.image, position: r.position,
      created_at: dt(r.created_at), updated_at: dt(r.updated_at),
    })));

    await insertAll("products", (await q("select * from products")).map((r) => ({
      id: r.id, category_id: r.category_id, name: r.name, name_ar: r.name_ar, slug: r.slug,
      short_description: r.short_description, short_description_ar: r.short_description_ar,
      details: json(r.details ?? []), base_price: r.base_price, discount_type: r.discount_type,
      discount_value: r.discount_value, sale_start: dt(r.sale_start), sale_end: dt(r.sale_end),
      vat_rate: r.vat_rate, status: r.status, tags: json(r.tags ?? []),
      min_order_qty: r.min_order_qty, min_order_value: r.min_order_value, allows_vessel: r.allows_vessel,
      vessel_price: r.vessel_price, vessel_deposit: r.vessel_deposit, is_rental: r.is_rental,
      rental_monthly_price: r.rental_monthly_price, rental_min_months: r.rental_min_months,
      rental_deposit: r.rental_deposit, created_at: dt(r.created_at), updated_at: dt(r.updated_at),
    })));

    await insertAll("product_images", (await q("select * from product_images")).map((r) => ({
      id: r.id, product_id: r.product_id, url: r.url, alt: r.alt, position: r.position,
      is_primary: r.is_primary, created_at: dt(r.created_at),
    })));

    await insertAll("offers", (await q("select * from offers")).map((r) => ({
      id: r.id, title: r.title, type: r.type, value: r.value, code: r.code, scope: r.scope,
      starts: dt(r.starts), ends: dt(r.ends), active: r.active, created_at: dt(r.created_at), updated_at: dt(r.updated_at),
    })));

    await insertAll("customers", (await q("select * from customers")).map((r) => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone, company: r.company, trn: r.trn,
      type: r.type, created_at: dt(r.created_at),
    })));

    await insertAll("orders", (await q("select * from orders")).map((r) => {
      const m = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
      return {
        id: r.id, number: r.number, public_token: r.public_token, customer_id: r.customer_id,
        channel: r.channel, status: m.status,
        payment_method: r.stripe_checkout_session_id ? "card" : "cod",
        payment_status: m.payment,
        subtotal: r.subtotal, vat: r.vat, delivery_fee: r.delivery_fee, deposit_total: r.deposit_total ?? 0,
        deposit_status: r.deposit_status ?? "none", total: r.total, currency: r.currency, emirate: r.emirate,
        address: json(r.address ?? {}), delivery_date: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
        notes: r.notes, stripe_checkout_session_id: r.stripe_checkout_session_id,
        stripe_payment_intent_id: r.stripe_payment_intent_id,
        paid_at: m.payment === "paid" ? dt(r.updated_at) : null,
        created_at: dt(r.created_at), updated_at: dt(r.updated_at),
      };
    }));

    await insertAll("order_items", (await q("select * from order_items")).map((r) => ({
      id: r.id, order_id: r.order_id, product_id: r.product_id, name: r.name, qty: r.qty,
      unit_price: r.unit_price, line_total: r.line_total, vessel: r.vessel ?? false,
      vessel_fee: r.vessel_fee ?? 0, deposit: r.deposit ?? 0, rental_months: r.rental_months,
    })));

    await insertAll("leads", (await q("select * from leads")).map((r) => ({
      id: r.id, company: r.company, contact: r.contact, email: r.email, phone: r.phone,
      requirement: r.requirement, frequency: r.frequency, emirate: r.emirate, budget: r.budget,
      message: r.message, stage: r.stage, created_at: dt(r.created_at), updated_at: dt(r.updated_at),
    })));

    await insertAll("blog_posts", (await q("select * from blog_posts")).map((r) => ({
      id: r.id, title: r.title, slug: r.slug, cover: r.cover, excerpt: r.excerpt, body: r.body,
      category: r.category, tags: json(r.tags ?? []), status: r.status, published_at: dt(r.published_at),
      seo_title: r.seo_title, seo_description: r.seo_description,
      created_at: dt(r.created_at), updated_at: dt(r.updated_at),
    })));

    await insertAll("payment_links", (await q("select * from payment_links")).map((r) => ({
      id: r.id, amount: r.amount, description: r.description, customer_id: r.customer_id, status: r.status,
      provider_ref: r.provider_ref, url: r.url, expires_at: dt(r.expires_at), paid_at: dt(r.paid_at),
      created_at: dt(r.created_at),
    })));

    const s = (await q("select * from store_settings limit 1"))[0];
    if (s) {
      await my.query(
        "UPDATE store_settings SET whatsapp_number=?, contact_phone=?, contact_email=?, trn=?, hero_image_url=? WHERE id=1",
        [s.whatsapp_number, s.contact_phone, s.contact_email, s.trn, s.hero_image_url],
      );
    }
    await my.commit();
  } catch (e) {
    await my.rollback();
    throw e;
  }

  console.table(counts);
  await pg.end();
  await my.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

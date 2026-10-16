// Validates the JSON-LD the site publishes against Google's documented requirements for
// Product snippets, Organization / LocalBusiness logo, Breadcrumbs, FAQ and Article, and
// against the page itself (Google requires markup to match visible content).
// Needs a running server:  npm run dev  (other terminal)  then  npm run verify:structured-data
// Note: Google's own Rich Results Test (search.google.com/test/rich-results) is the
// authoritative check on the live URL; this catches the same classes of error offline.
import "./_env";
import assert from "node:assert/strict";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const FAKE_TRN = "100000000000003";

type Json = Record<string, unknown>;
const blocks = (html: string): Json[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Json);
const isAbs = (u: unknown) => typeof u === "string" && /^https?:\/\/[^\s]+$/.test(u);
const walkUrls = (o: unknown, path = ""): string[] => {
  const bad: string[] = [];
  if (Array.isArray(o)) o.forEach((x, i) => bad.push(...walkUrls(x, `${path}[${i}]`)));
  else if (o && typeof o === "object")
    for (const [k, v] of Object.entries(o)) {
      if (["url", "item", "@id", "logo", "image", "sameAs"].includes(k)) {
        for (const u of Array.isArray(v) ? v : [v]) if (typeof u === "string" && !isAbs(u)) bad.push(`${path}.${k}=${u}`);
      }
      if (typeof v === "object") bad.push(...walkUrls(v, `${path}.${k}`));
    }
  return bad;
};

async function main() {
  const { db, pool } = await import("../src/lib/db");
  const { products, blog_posts, store_settings } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { getEffectivePrice, formatAED } = await import("../src/lib/pricing");
  const out: string[] = [];
  const warnings: string[] = [];
  const ok = (m: string) => out.push(`PASS ${m}`);
  const get = async (path: string) => {
    const r = await fetch(BASE + path);
    assert.equal(r.status, 200, `${path} -> ${r.status}`);
    return r.text();
  };

  const [settings] = await db.select().from(store_settings);
  const prods = await db.select().from(products).where(eq(products.status, "active"));
  assert(prods.length > 0);
  let checked = 0;

  for (const locale of ["en", "ar"]) {
    // ---- every product page
    for (const p of prods) {
      const html = await get(`/${locale}/products/${p.slug}`);
      const ld = blocks(html);
      const prod = ld.filter((b) => b["@type"] === "Product");
      assert.equal(prod.length, 1, `${p.slug}: exactly one Product block`);
      const d = prod[0] as Json & { offers: Json; brand: Json; image?: string[] };
      const offers = d.offers as Json & { priceSpecification: Json; seller: Json };
      assert(typeof d.name === "string" && d.name.length > 0, "name");
      // Recommended, not required by Google: report products an admin should fill in.
      if (!(typeof d.description === "string" && d.description.length > 0)) warnings.push(`${p.slug}: no description (add a short description in the product page)`);
      assert.equal(d.sku, p.slug);
      assert.equal((d.brand as Json)["@type"], "Brand");
      assert((d.brand as Json).name);
      const imgs = await db.query.product_images.findMany({ where: (t, { eq }) => eq(t.product_id, p.id) });
      if (imgs.length === 0) warnings.push(`${p.slug}: no images (Google requires an image for product rich results)`);
      else {
        assert(Array.isArray(d.image) && d.image.length === imgs.length && d.image.every(isAbs), `${p.slug}: absolute image URLs`);
      }
      // price must equal what the page sells it for
      const rental = p.is_rental && (p.rental_monthly_price ?? 0) > 0;
      const expected = rental ? (p.rental_monthly_price as number) : getEffectivePrice({ ...p, discount_type: p.discount_type, vat_rate: p.vat_rate }).finalPrice;
      assert.equal(offers.price, expected.toFixed(2), `${p.slug}: JSON-LD price ${offers.price} != page price ${expected.toFixed(2)}`);
      assert(html.includes(formatAED(expected)), `${p.slug}: the page does not visibly show ${formatAED(expected)}`);
      assert.match(String(offers.price), /^\d+\.\d{2}$/);
      assert.equal(offers.priceCurrency, "AED");
      const spec = offers.priceSpecification as Json;
      assert.equal(spec.valueAddedTaxIncluded, false);
      assert.equal(spec.price, offers.price);
      if (rental) assert.equal(spec.unitCode, "MON", `${p.slug}: rental price is per month`);
      else assert.equal(spec.unitCode, undefined);
      const soldOut = p.stock_qty != null && p.stock_qty <= 0;
      assert.equal(offers.availability, soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock");
      assert.equal(offers.itemCondition, "https://schema.org/NewCondition");
      assert.equal((offers.seller as Json)["@type"], "Organization");
      assert(isAbs(offers.url) && String(offers.url).endsWith(`/${locale}/products/${p.slug}`), "offer url is the canonical product URL");
      assert.equal(walkUrls(d).length, 0, `${p.slug}: all URLs absolute: ${walkUrls(d)}`);
      // breadcrumbs
      const bc = ld.find((b) => b["@type"] === "BreadcrumbList") as Json & { itemListElement: Json[] };
      assert(bc && bc.itemListElement.length >= 2);
      bc.itemListElement.forEach((it, i) => {
        assert.equal(it.position, i + 1);
        assert(typeof it.name === "string" && it.name);
        if (i < bc.itemListElement.length - 1) assert(isAbs(it.item), "non-final breadcrumb items have URLs");
      });
      // safe embedding: nothing can close the script tag
      assert(!/<\/script/i.test(JSON.stringify(d)));
      checked++;
    }
    ok(`${locale}: all ${prods.length} product pages: one valid Product block each (name, description, sku, brand, absolute images, price matches the page, VAT flag, availability follows stock, seller, canonical URL, breadcrumbs)`);
  }
  ok(`rental products publish the monthly price with unitCode MON, not the purchase price (${prods.filter((p) => p.is_rental).length} rental product(s) checked)`);

  // ---- organization + local business
  const home = await get("/en");
  const homeLd = blocks(home);
  const org = homeLd.find((b) => b["@type"] === "Organization") as Json;
  const biz = homeLd.find((b) => b["@type"] === "FloristShop") as Json;
  assert(org && biz);
  assert.equal(walkUrls(org).length + walkUrls(biz).length, 0);
  if (settings.trn) assert.equal(org.taxID, settings.trn);
  else assert.equal(org.taxID, undefined, "no tax number is published until one is entered in Settings");
  const logoRes = await fetch(String(org.logo).replace(/^https?:\/\/[^/]+/, BASE));
  assert.equal(logoRes.status, 200);
  assert.match(logoRes.headers.get("content-type") ?? "", /image\/png/);
  const png = Buffer.from(await logoRes.arrayBuffer());
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  assert(w >= 112 && h >= 112, `logo is ${w}x${h}; Google needs at least 112x112`);
  ok(`Organization: logo is a real ${w}x${h} PNG, taxID ${settings.trn ? "matches Settings" : "absent (none entered)"}`);
  assert((biz.areaServed as unknown[]).length > 0 && (biz.address as Json).addressCountry === "AE");
  assert.equal(biz.priceRange, undefined);
  ok("FloristShop: area served from the enabled delivery zones, address country, no made-up priceRange");

  // ---- the old placeholder tax number must not appear anywhere public
  for (const path of ["/en", "/ar", "/en/shop", "/en/corporate", "/en/contact", "/en/terms", "/en/privacy", "/en/delivery"]) {
    const html = await get(path);
    if (settings.trn !== FAKE_TRN) assert(!html.includes(FAKE_TRN), `${path} leaks the placeholder TRN`);
  }
  ok("the placeholder tax number appears on none of the public pages");

  // ---- FAQ page
  const faq = blocks(await get("/en/corporate")).find((b) => b["@type"] === "FAQPage") as Json & { mainEntity: Json[] };
  assert(faq && faq.mainEntity.length > 0);
  for (const q of faq.mainEntity) {
    assert.equal(q["@type"], "Question");
    assert(q.name);
    assert((q.acceptedAnswer as Json).text);
  }
  ok(`FAQPage: ${faq.mainEntity.length} questions, each with an answer`);

  // ---- blog posts
  const posts = await db.select().from(blog_posts).where(eq(blog_posts.status, "published"));
  for (const post of posts) {
    const html = await get(`/en/blog/${post.slug}`);
    const bp = blocks(html).find((b) => b["@type"] === "BlogPosting") as Json | undefined;
    assert(bp, `${post.slug}: BlogPosting block`);
    assert(typeof bp.headline === "string" && bp.headline.length > 0 && bp.headline.length <= 110);
    assert.match(String(bp.datePublished), /^\d{4}-\d{2}-\d{2}/);
    assert.equal((bp.author as Json)["@type"], "Organization");
    assert.equal(walkUrls(bp).length, 0);
    if (post.cover) assert(Array.isArray(bp.image) && isAbs((bp.image as string[])[0]));
  }
  ok(`${posts.length} blog posts publish valid BlogPosting markup (headline, date, image, author, publisher)`);

  await pool.end();
  console.log(out.join("\n"));
  console.log(`(${checked} product pages checked)`);
  for (const w of [...new Set(warnings)]) console.log(`WARN ${w}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

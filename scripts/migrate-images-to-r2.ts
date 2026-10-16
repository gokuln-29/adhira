// Moves every image still hosted on Supabase Storage / Unsplash into R2, running
// each through the same pipeline as admin uploads (decode, strip EXIF, WebP,
// derivatives), then rewrites the URLs in MySQL. Idempotent: rows already on the
// media domain are skipped. Safe to re-run after a partial failure.
//   npm run media:migrate [-- --dry] [--clear-broken]
// --clear-broken: a source that downloads but isn't a valid image (e.g. a 29-byte HTML
// stub from a failed old upload) is removed (NULLed / row deleted) instead of left pointing
// at a host the site no longer allows.
import "./_env";

async function main() {
  const dry = process.argv.includes("--dry");
  const clearBroken = process.argv.includes("--clear-broken");
  const { db, pool } = await import("../src/lib/db");
  const { blog_posts, categories, product_images, store_settings } = await import("../src/lib/db/schema");
  const { processAndPublish } = await import("../src/lib/media/store");
  const { keyFromPublicUrl } = await import("../src/lib/media/r2");
  const { eq } = await import("drizzle-orm");

  const isOurs = (u: string | null) => !u || keyFromPublicUrl(u) !== null;
  const stats = { migrated: 0, skipped: 0, failed: 0 };

  async function move(url: string, purpose: "product" | "category" | "hero" | "blog") {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`download ${res.status}`);
    return processAndPublish(Buffer.from(await res.arrayBuffer()), purpose);
  }

  const run = async (label: string, url: string | null, apply: (img: Awaited<ReturnType<typeof move>>) => Promise<void>, purpose: Parameters<typeof move>[1], clear?: () => Promise<void>) => {
    if (!url || isOurs(url)) return void stats.skipped++;
    if (dry) return void console.log("would migrate", label, url);
    try {
      await apply(await move(url, purpose));
      stats.migrated++;
    } catch (err) {
      if (clearBroken && clear && /readable|Only JPEG/.test((err as Error).message)) {
        await clear();
        console.warn("CLEARED broken source", label, url);
        return void stats.skipped++;
      }
      stats.failed++;
      console.error("FAILED", label, url, (err as Error).message);
    }
  };

  for (const r of await db.select().from(product_images)) {
    await run(`product_image ${r.id}`, r.url, async (img) => {
      await db
        .update(product_images)
        .set({ url: img.url, object_key: img.key, width: img.width, height: img.height, bytes: img.bytes, checksum: img.checksum, mime_type: img.mime_type })
        .where(eq(product_images.id, r.id));
    }, "product", async () => void (await db.delete(product_images).where(eq(product_images.id, r.id))));
  }
  for (const r of await db.select().from(categories)) {
    await run(`category ${r.slug}`, r.image, async (img) => void (await db.update(categories).set({ image: img.url }).where(eq(categories.id, r.id))), "category", async () => void (await db.update(categories).set({ image: null }).where(eq(categories.id, r.id))));
  }
  for (const r of await db.select().from(blog_posts)) {
    await run(`blog ${r.slug}`, r.cover, async (img) => void (await db.update(blog_posts).set({ cover: img.url }).where(eq(blog_posts.id, r.id))), "blog", async () => void (await db.update(blog_posts).set({ cover: null }).where(eq(blog_posts.id, r.id))));
  }
  for (const r of await db.select().from(store_settings)) {
    await run("hero", r.hero_image_url, async (img) => void (await db.update(store_settings).set({ hero_image_url: img.url }).where(eq(store_settings.id, 1))), "hero", async () => void (await db.update(store_settings).set({ hero_image_url: null }).where(eq(store_settings.id, 1))));
  }

  console.log(stats);
  await pool.end();
  if (stats.failed) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "server-only";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rate_limits } from "@/lib/db/schema";

// Client IP behind Nginx. Nginx overwrites X-Forwarded-For with $remote_addr
// (see docs/DEPLOYMENT.md), so the first entry can be trusted.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Fixed-window limiter in MySQL so it works across PM2 workers without Redis.
// Returns true while the caller is within `max` hits per `windowSeconds`.
// Fails open on a database error: a limiter outage must not take checkout down.
export async function withinRateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    return await hitRateLimit(`${bucket}:${await getClientIp()}`, max, windowSeconds);
  } catch (err) {
    console.error("[rate-limit]", err);
    return true;
  }
}

// Same limiter keyed by an arbitrary string (e.g. an email address).
export async function hitRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const k = key.slice(0, 255);
  return db.transaction(async (tx) => {
    // In ON DUPLICATE KEY UPDATE, assignments run left to right and see earlier
    // ones, so `hits` must be computed before `window_start` is reset.
    await tx.execute(sql`
      INSERT INTO rate_limits (\`key\`, window_start, hits) VALUES (${k}, UTC_TIMESTAMP(3), 1)
      ON DUPLICATE KEY UPDATE
        hits = IF(window_start < UTC_TIMESTAMP(3) - INTERVAL ${windowSeconds} SECOND, 1, hits + 1),
        window_start = IF(window_start < UTC_TIMESTAMP(3) - INTERVAL ${windowSeconds} SECOND, UTC_TIMESTAMP(3), window_start)
    `);
    const row = await tx.select({ hits: rate_limits.hits }).from(rate_limits).where(eq(rate_limits.key, k)).limit(1);
    if (Math.random() < 0.01) {
      await tx.execute(sql`DELETE FROM rate_limits WHERE window_start < UTC_TIMESTAMP(3) - INTERVAL 1 DAY`);
    }
    return (row[0]?.hits ?? 1) <= max;
  });
}

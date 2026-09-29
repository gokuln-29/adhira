import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Best-effort client IP behind Vercel / a reverse proxy.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// Fixed-window limiter backed by the `hit_rate_limit()` Postgres function, so
// it works across serverless instances without Redis. Returns true when the
// caller is still within `max` hits per `windowSeconds`. Fails open on a
// database error: a limiter outage must not take checkout down.
export async function withinRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const ip = await getClientIp();
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_key: `${bucket}:${ip}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

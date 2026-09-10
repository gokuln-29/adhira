import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Anon-key client with no cookie plumbing (unlike lib/supabase/server.ts,
// which calls cookies() and forces the page dynamic). Use this for
// public-only reads — sitemap generation, and storefront pages that don't
// depend on the visitor's session — so those routes stay static/ISR-able.
// RLS still applies (this is the anon key, not the service role): it can
// only ever read what an anonymous visitor could read anyway.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

// Supabase magic-link redirect target. Lives outside `[locale]` and is
// excluded from the proxy's i18n matcher so the raw callback URL isn't
// rewritten before the auth code can be exchanged.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(
    new URL(`/${routing.defaultLocale}/account`, request.url),
  );
}

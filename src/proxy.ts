import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // /admin is a single, non-localized surface — skip next-intl's locale
  // routing there entirely so it isn't rewritten to /en/admin.
  const isAdmin = request.nextUrl.pathname.startsWith("/admin");
  const response = isAdmin ? NextResponse.next() : handleI18nRouting(request);

  // Refreshing the Supabase session is a network round trip, so do it only
  // where a session is actually read: /admin and the locale-prefixed account
  // pages. Public storefront pages skip it entirely (faster TTFB, and they
  // stay cacheable).
  const needsSession = isAdmin || /^\/(en|ar)\/account(\/|$)/.test(request.nextUrl.pathname);
  if (!needsSession) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};

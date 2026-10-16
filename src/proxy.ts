import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Locale routing only. Sessions are server-side (DB-backed cookies read by
// Server Components/actions), so nothing needs refreshing here.
export default function proxy(request: NextRequest) {
  // /admin is a single, non-localized surface — skip next-intl's locale
  // routing there entirely so it isn't rewritten to /en/admin.
  if (request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  return handleI18nRouting(request);
}

export const config = {
  // icon / apple-icon / opengraph-image are generated routes with no file extension.
  matcher: ["/((?!api|invoice|_next|_vercel|icon|apple-icon|opengraph-image|.*\\..*).*)"],
};

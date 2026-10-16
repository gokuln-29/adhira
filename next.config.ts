import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";
// Public media domain (Cloudflare R2 behind a custom hostname), e.g.
// https://media.adhiraflowers.ae. Local dev points at MinIO.
const mediaUrl = process.env.MEDIA_PUBLIC_URL ? new URL(process.env.MEDIA_PUBLIC_URL) : null;
const mediaOrigin = mediaUrl?.origin ?? "";
const r2Origin = process.env.R2_ENDPOINT
  ? new URL(process.env.R2_ENDPOINT).origin
  : process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "";

// Next.js injects small inline scripts/styles, so script-src/style-src keep
// 'unsafe-inline' (a nonce-based policy would force every page dynamic and
// undo the caching). Everything else is locked to known origins.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://images.unsplash.com ${mediaOrigin}`,
  "font-src 'self' data:",
  // The admin uploader PUTs straight to R2 with a presigned URL.
  `connect-src 'self' ${r2Origin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (VPS deploy).
  output: "standalone",
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Admin and order pages hold private data: never cache or index them.
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/:locale/order-confirmation/:token",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  images: {
    // Next 16 blocks image optimization against private IPs by default (SSRF
    // protection) — correct in production, but local MinIO lives at 127.0.0.1
    // in dev, so only opt out there.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    // Next 16 requires an explicit allowlist (default is [75] only) — any
    // quality prop not listed here is silently coerced to the nearest
    // allowed value. 60 is used for priority/LCP images to cut bytes.
    qualities: [60, 65, 75, 80],
    remotePatterns: [
      ...(mediaUrl
        ? [
            {
              protocol: mediaUrl.protocol.replace(":", "") as "http" | "https",
              hostname: mediaUrl.hostname,
              ...(mediaUrl.port ? { port: mediaUrl.port } : {}),
              pathname: `${mediaUrl.pathname.replace(/\/$/, "")}/**`,
            },
          ]
        : []),
      // Seed/placeholder imagery only.
      { protocol: "https" as const, hostname: "images.unsplash.com" },
    ],
  },
};

export default withNextIntl(nextConfig);

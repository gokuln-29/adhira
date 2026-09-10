import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Next 16 blocks image optimization against private IPs by default (SSRF
    // protection) — correct in production, but local Supabase Storage lives
    // at 127.0.0.1 in dev, so only opt out there.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    // Next 16 requires an explicit allowlist (default is [75] only) — any
    // quality prop not listed here is silently coerced to the nearest
    // allowed value. 60 is used for priority/LCP images to cut bytes.
    qualities: [60, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Local Supabase Storage (`supabase start`) — harmless in production,
        // since this host never resolves there.
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Seed/placeholder imagery only — real product photos come from
        // Supabase Storage via the admin uploader.
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);

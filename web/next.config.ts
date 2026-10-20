import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** "https://abc.supabase.co/x" → "https://abc.supabase.co" (empty if not a URL). */
function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url.replace(/\{[a-z]\}/g, "a")).origin : "";
  } catch {
    return "";
  }
}

const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
// Map tiles: the configured provider, or OpenStreetMap during development only.
const mapTiles = process.env.NEXT_PUBLIC_MAP_TILE_URL
  ? originOf(process.env.NEXT_PUBLIC_MAP_TILE_URL)
  : isDev
    ? "https://tile.openstreetmap.org"
    : "";

// Content Security Policy: the browser refuses scripts, images, connections
// and frames from anywhere not listed here. 'unsafe-inline' for scripts is
// required by Next.js without per-request nonces (which would prevent caching).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} ${mapTiles}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabase}${isDev ? " ws: wss:" : ""}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Always use HTTPS for two years, including subdomains (ignored on http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site never needs the camera, microphone, location, payments, etc.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

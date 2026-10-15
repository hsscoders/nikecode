/** @type {import('next').NextConfig} */

/* ============================================================
   API proxy target — server-side only. Set API_ORIGIN on the
   server (cPanel → Setup Node.js App → Environment variables)
   or in frontend/Admin/.env for local dev:
     API_ORIGIN = https://api.yourdomain.com
   Default keeps the local development setup. Changing it needs
   an app restart, NOT a rebuild.
   ============================================================ */
const API_ORIGIN = process.env.API_ORIGIN || "http://127.0.0.1:3030";

/* ============================================================
   Security headers — same hardening as the Client app:
   nosniff, referrer lock-down, permissions lock-down, and a
   CSP that blocks plugin objects + base hijacks (the admin panel
   is the highest-value target, so no plugin/embed surface at all).
   poweredByHeader off: stop advertising the framework version.
   ============================================================ */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors *",
  },
];

const nextConfig = {
  poweredByHeader: false,
  /* Assets are served under the /admin/_next/* prefix so they also load correctly
     through the Client (:3000) /admin/* proxy rewrite (single-port preview) */
  assetPrefix: "/admin",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
      {
        source: "/admin/_next/:path*",
        destination: "/_next/:path*",
      },
      {
        source: "/banners/:path*",
        destination: `${API_ORIGIN}/banners/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${API_ORIGIN}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

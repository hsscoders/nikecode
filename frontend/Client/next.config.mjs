/** @type {import('next').NextConfig} */

/* ============================================================
   Proxy targets — server-side only (browser always talks to THIS
   origin, the rewrites forward /api, /admin, /banners, /uploads).

   Set on the server (cPanel → Setup Node.js App → Environment
   variables) or in frontend/Client/.env for local dev:
     API_ORIGIN   = https://api.yourdomain.com   (backend app)
     ADMIN_ORIGIN = https://admin.yourdomain.com (admin app)
   Defaults keep the local development setup (localhost ports).
   Changing these needs an app restart, NOT a rebuild.
   ============================================================ */
const API_ORIGIN = process.env.API_ORIGIN || "http://127.0.0.1:3030";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN || "http://127.0.0.1:3001";

/* ============================================================
   Security headers — defense-in-depth on every HTML response:
   - nosniff: the browser can never re-interpret a response as
     executable content (drive-by MIME confusion).
   - Referrer-Policy: internal URLs (tokens in /auto-login?code=…)
     never leak to the external sites we link out to.
   - Permissions-Policy: the app needs no camera/mic/geo — turn
     them off so an embedded frame cannot prompt for them either.
   - object-src 'none' + base-uri 'self': blocks <object>/<embed>
     plugin payloads and <base href> hijacks, without breaking the
     inline theme-boot script (no script-src lockdown needed here —
     Next.js injects its own inline bootstrap chunks).
   - poweredByHeader off: stop advertising the framework version.
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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
      {
        source: "/admin/:path*",
        destination: `${ADMIN_ORIGIN}/admin/:path*`,
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

/* Server-side backend origin for SSR/ISR fetches (layout settings,
   /home banners+plans). Mirrors the rewrite target in next.config.mjs:
   set API_ORIGIN in the environment (cPanel Node.js app env vars or
   frontend/Client/.env) — defaults keep local development working. */
export const BACKEND_ORIGIN =
  process.env.API_ORIGIN || "http://127.0.0.1:3030";

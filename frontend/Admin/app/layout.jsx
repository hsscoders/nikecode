import fs from "fs";
import path from "path";
import "./globals.css";
import AdminThemeProvider from "./components/AdminThemeProvider";

export const metadata = {
  title: "Master Admin",
  description: "Admin Panel — Manage plans, users, deposits, withdrawals & site settings",
};

/* Explicit viewport — keeps the panel sized correctly on mobile browsers */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/* ---- Theme engine (plain JS, no imports) — inlined into <head> ----
   Read once per server process. Runs BEFORE first paint so a refresh
   never flashes the fallback indigo theme (FOUC fix). The same engine
   powers the client site, so both surfaces always share one look. */
let THEME_ENGINE = "";
try {
  THEME_ENGINE = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "theme-engine.js"),
    "utf8"
  );
} catch (e) {}

/* ---- SSR appearance ----
   The admin panel mirrors the client website's Font & Color theme.
   Fetched server-side (no-store = always fresh) and baked into the
   boot script — the very first paint already shows the saved theme.
   Fails soft: backend down → null → localStorage cache fallback. */
const API_ORIGIN = process.env.API_ORIGIN || "http://127.0.0.1:3030";

async function getAppearance() {
  try {
    const r = await fetch(API_ORIGIN + "/api/settings", { cache: "no-store" });
    const d = await r.json();
    return d && d.success && d.settings ? d.settings.appearance || null : null;
  } catch (e) {
    return null;
  }
}

export default async function RootLayout({ children }) {
  const appearance = await getAppearance();

  /* Boot order: server theme (freshest) → localStorage cache fallback.
     Both apply inside ONE synchronous script, so the very first paint
     already shows the correct theme. */
  const boot =
    THEME_ENGINE +
    "\nwindow.__ADMIN_APPEARANCE__=" +
    JSON.stringify(appearance || null).replace(/</g, "\\u003c") +
    ";" +
    "\n(function(){var A=window.__ADMIN_APPEARANCE__;" +
    "if(!A){try{A=JSON.parse(localStorage.getItem('zapto_appearance')||'null')}catch(e){}}" +
    "try{if(A&&window.ZaptoTheme)window.ZaptoTheme.applyTheme(A)}catch(e){}})();";

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Font & Color panel fonts — every family the admin can pick */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=Dancing+Script:wght@400;600;700&family=Inter:wght@400;500;600;700;800&family=Josefin+Sans:wght@400;500;600;700&family=Lato:wght@400;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700;900&family=Mulish:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Quicksand:wght@400;500;600;700&family=Roboto:wght@400;500;600;700;800&family=Rubik:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AdminThemeProvider />
        {children}
      </body>
    </html>
  );
}

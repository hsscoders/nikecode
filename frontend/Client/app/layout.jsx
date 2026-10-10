import fs from "fs";
import path from "path";
import "./globals.css";
import GlobalAuthGuard from "./components/GlobalAuthGuard";
import AppearanceProvider from "./components/AppearanceProvider";
import SettingsProvider from "./components/SettingsProvider";

export const metadata = {
  title: "",
  description: "Login & Register",
};

/* ---- Theme engine (plain JS, no imports) — inlined into <head> ----
   Read once per server process. Runs BEFORE first paint so a refresh
   never flashes the default maroon theme (FOUC fix). */
let THEME_ENGINE = "";
try {
  THEME_ENGINE = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "theme-engine.js"),
    "utf8"
  );
} catch (e) {}

/* ---- SSR settings ----
   FULL settings (appearance, recharge, withdraw, site, popup) baked
   into the HTML (ISR 15s) — the theme applies before first paint AND
   pages (recharge/withdraw/home/login) render admin-configured values
   instantly, no 1s default flash. Fails soft: backend down → null →
   client API fetch fallback. */
async function getSettings() {
  try {
    const r = await fetch("http://127.0.0.1:3030/api/settings", {
      next: { revalidate: 15 },
    });
    const d = await r.json();
    return d && d.success ? d.settings || null : null;
  } catch (e) {
    return null;
  }
}

export default async function RootLayout({ children }) {
  const settings = await getSettings();
  const appearance = settings?.appearance || null;

  /* Boot order: server theme (freshest, ≤15s old) → localStorage cache
     fallback. Both apply inside ONE synchronous script, so the very
     first paint already shows the correct theme. */
  const boot =
    THEME_ENGINE +
    "\nwindow.__ZAPTO_APPEARANCE__=" +
    JSON.stringify(appearance || null).replace(/</g, "\\u003c") +
    ";" +
    "\n(function(){var A=window.__ZAPTO_APPEARANCE__;" +
    "if(!A){try{A=JSON.parse(localStorage.getItem('zapto_appearance')||'null')}catch(e){}}" +
    "try{if(A&&window.ZaptoTheme)window.ZaptoTheme.applyTheme(A)}catch(e){}})();";

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Font & Color panel fonts — every family the admin can pick */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=Dancing+Script:wght@400;600;700&family=Inter:wght@400;500;600;700;800&family=Josefin+Sans:wght@400;500;600;700&family=Lato:wght@400;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700;900&family=Mulish:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Quicksand:wght@400;500;600;700&family=Roboto:wght@400;500;600;700&family=Rubik:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SettingsProvider initial={settings}>
          <GlobalAuthGuard />
          <AppearanceProvider />
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";

/* ============ ADMIN APPEARANCE PROVIDER (runtime layer) ============
   The heavy lifting (palettes, derivation, applying CSS vars) lives in
   theme-engine.js, which layout.jsx ALSO inlines into <head> — that
   inline copy runs BEFORE the first paint, so a refresh never flashes
   the fallback indigo theme. This provider handles the runtime side:

   1. Re-applies the localStorage cache (belt & suspenders)
   2. Refreshes from the public settings API — the same appearance
      config the client site uses, so BOTH always match
   3. Listens for the "admin:appearance" window event so the Font &
      Color page applies a fresh save instantly (no reload) */
const CACHE_KEY = "zapto_appearance";

export default function AdminThemeProvider() {
  useEffect(() => {
    const applyAndCache = (a) => {
      if (!a) return;
      try {
        window.ZaptoTheme.applyTheme(a);
      } catch (e) {}
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(a));
      } catch (e) {}
    };

    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && window.ZaptoTheme) window.ZaptoTheme.applyTheme(cached);
    } catch (e) {}

    (async () => {
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (d.success && d.settings && d.settings.appearance)
          applyAndCache(d.settings.appearance);
      } catch (e) {}
    })();

    /* Font & Color page just saved → restyle this panel instantly */
    const onSaved = (e) => applyAndCache(e.detail);
    window.addEventListener("admin:appearance", onSaved);
    return () => window.removeEventListener("admin:appearance", onSaved);
  }, []);
  return null;
}

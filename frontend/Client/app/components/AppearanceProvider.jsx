"use client";

import { useEffect } from "react";

/* ============ APPEARANCE PROVIDER (runtime layer) ============
   The heavy lifting (palettes, derivation, applying CSS vars) lives in
   theme-engine.js, which layout.jsx ALSO inlines into <head> — that
   inline copy runs BEFORE first paint, so a page refresh never flashes
   the default maroon theme. This provider handles the runtime side:

   1. Re-applies the localStorage cache (belt & suspenders)
   2. Refreshes from the settings API — admin's saved theme lands here
   3. Listens for realtime socket broadcasts ("zapto:appearance") so a
      saved theme restyles every open page instantly, no reload */
export default function AppearanceProvider() {
  useEffect(() => {
    const applyAndCache = (a) => {
      if (!a) return;
      try {
        window.ZaptoTheme.applyTheme(a);
      } catch (e) {}
      try {
        localStorage.setItem("zapto_appearance", JSON.stringify(a));
      } catch (e) {}
    };

    try {
      const cached = JSON.parse(localStorage.getItem("zapto_appearance") || "null");
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

    /* Realtime: admin saved a new theme → restyle live */
    const onLive = (e) => applyAndCache(e.detail);
    window.addEventListener("zapto:appearance", onLive);
    return () => window.removeEventListener("zapto:appearance", onLive);
  }, []);
  return null;
}

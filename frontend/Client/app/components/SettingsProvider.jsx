"use client";

import { createContext, useContext, useEffect, useState } from "react";

/* ============ SETTINGS PROVIDER (SSR-seeded) ============
   layout.jsx fetches the full settings server-side (ISR 15s) and
   passes them here as `initial` — those values are baked into the
   HTML, so pages render admin-configured amounts/titles/popup on
   the VERY FIRST PAINT (no 1s default flash after refresh).

   Pages read via useSettings() to seed their initial state, and
   still refresh from the API for the latest truth. */
const SettingsContext = createContext(null);

export const useSettings = () => useContext(SettingsContext);

export default function SettingsProvider({ initial, children }) {
  const [settings, setSettings] = useState(initial || null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (alive && d.success && d.settings) setSettings(d.settings);
      } catch (e) {}
    };
    load();
    /* live — admin saves any setting (recharge UPI/QR, withdraw limits,
       popup text…) → every open page refetches instantly, no reload */
    const onLive = (e) => {
      const d = e.detail || {};
      if (d.event === "settings:update" || d.event === "appearance:changed") load();
    };
    window.addEventListener("zapto:live", onLive);
    return () => {
      alive = false;
      window.removeEventListener("zapto:live", onLive);
    };
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

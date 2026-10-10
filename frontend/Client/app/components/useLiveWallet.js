"use client";

import { useEffect } from "react";
import { readCache } from "./liveCache";

/* Subscribe to realtime wallet pushes + instant cache hydration.
   - On mount: instantly seeds from the localStorage cache (zapto_cache_wallet) —
     no ₹0 flash after refresh, the previous balance shows immediately.
   - Live: GlobalAuthGuard caches every /api/wallet response and fans it out
     through the "zapto:wallet" CustomEvent; the socket wallet:refresh event
     feeds into the same flow — the page always stays fresh. */
export default function useLiveWallet(setWallet) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof setWallet !== "function") return;

    /* instant paint from cache (stale-while-revalidate) */
    const cached = readCache("wallet");
    if (cached && typeof cached === "object") {
      setWallet((w) => ({ ...w, ...cached }));
    }

    const h = (e) => {
      if (e.detail) setWallet((w) => ({ ...w, ...e.detail }));
    };
    window.addEventListener("zapto:wallet", h);
    return () => window.removeEventListener("zapto:wallet", h);
  }, [setWallet]);
}

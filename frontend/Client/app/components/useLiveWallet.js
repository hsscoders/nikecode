"use client";

import { useEffect } from "react";
import { readCache } from "./liveCache";

/* Subscribe to realtime wallet pushes + instant cache hydration.
   - Mount par: localStorage cache (zapto_cache_wallet) se TURANT seed —
     refresh ke baad ₹0 ka flash nahi, pichhli balance foran dikhti hai.
   - Live: GlobalAuthGuard har /api/wallet response ko cache + "zapto:wallet"
     CustomEvent me fan-out karta hai; socket wallet:refresh bhi isi se
     aata hai — page hamesha fresh rehta hai. */
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

"use client";

import { useEffect } from "react";

/* Subscribe to realtime wallet pushes.
   GlobalAuthGuard receives the socket event, refetches /api/wallet and
   dispatches "zapto:wallet"; this hook funnels it into the page state. */
export default function useLiveWallet(setWallet) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof setWallet !== "function") return;
    const h = (e) => {
      if (e.detail) setWallet((w) => ({ ...w, ...e.detail }));
    };
    window.addEventListener("zapto:wallet", h);
    return () => window.removeEventListener("zapto:wallet", h);
  }, [setWallet]);
}

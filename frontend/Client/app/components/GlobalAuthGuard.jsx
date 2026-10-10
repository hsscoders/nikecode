"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { clearUserSession } from "./liveCache";

/* Global JWT guard — when an authed API returns 401 (expired/invalid
   token) on any page, clear the token and send the user to /login?expired=1.
   Login/register/auto-login pages are excluded (there a 401 just means a
   wrong password — no redirect loops). */
export default function GlobalAuthGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    /* ---- live socket (realtime wallet updates) ---- */
    if (!window.__zaptoSocket) {
      try {
        const token = localStorage.getItem("zapto_token");
        const sock = io({
          path: "/api/socket.io",
          addTrailingSlash: false,
          transports: ["polling", "websocket"],
          auth: { token },
          reconnectionDelayMax: 10000,
        });
        window.__zaptoSocket = sock;

        /* EVERY server event → window CustomEvent fan-out ("zapto:live").
           Pages subscribe with useLive() — records/transaction/withdrawal/
           card/home all refresh instantly, no manual reload anywhere. */
        const LIVE_EVENTS = [
          "wallet:refresh",
          "activity:update",
          "plans:update",
          "banners:update",
          "settings:update",
          "appearance:changed",
        ];
        LIVE_EVENTS.forEach((ev) => {
          sock.on(ev, (payload) => {
            window.dispatchEvent(
              new CustomEvent("zapto:live", { detail: { event: ev, detail: payload || {} } })
            );
          });
        });

        /* server pushed a wallet change (recharge approved, income,
           commission...) — refetch once and fan out via CustomEvent
           (interceptor bhi cache + fan-out karta hai) */
        sock.on("wallet:refresh", async () => {
          try {
            const t = localStorage.getItem("zapto_token");
            if (!t) return;
            await window.fetch("/api/wallet", {
              headers: { Authorization: "Bearer " + t },
            });
          } catch (e) {}
        });
        /* admin saved a new theme — fan out to AppearanceProvider */
        sock.on("appearance:changed", (a) => {
          window.dispatchEvent(
            new CustomEvent("zapto:appearance", { detail: a || {} })
          );
        });
      } catch (e) {}
    }

    if (window.__zaptoAuthHooked) return;
    window.__zaptoAuthHooked = true;

    /* ---- wallet response interceptor ----
       EVERY successful /api/wallet response (from any page) →
       localStorage cache + "zapto:wallet" fan-out. This way, on the next
       refresh every page shows its balance instantly from localStorage
       (no ₹0 flash) — the fresh value arrives after the network call. */
    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await orig(...args);
      try {
        const url =
          typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
        if (res && res.ok && /\/api\/wallet(\?|#|$)/.test(url)) {
          res
            .clone()
            .json()
            .then((d) => {
              if (d && d.success && d.wallet) {
                try {
                  localStorage.setItem(
                    "zapto_cache_wallet",
                    JSON.stringify({ ts: Date.now(), data: d.wallet })
                  );
                } catch (e) {}
                window.dispatchEvent(
                  new CustomEvent("zapto:wallet", { detail: d.wallet })
                );
              }
            })
            .catch(() => {});
        }
        const onAuthPage = /^\/(login|register|auto-login)(\/|\?|#|$)/.test(
          window.location.pathname
        );
        if (
          res &&
          res.status === 401 &&
          url.includes("/api/") &&
          !url.includes("/api/auth/") &&
          !onAuthPage
        ) {
          /* session expired — wipe EVERYTHING user-specific before the
             redirect so no data leaks into the next login */
          clearUserSession();
          try {
            if (window.__zaptoSocket) window.__zaptoSocket.disconnect();
          } catch (e) {}
          window.location.replace("/login?expired=1");
        }
      } catch (e) {}
      return res;
    };
  }, []);

  return null;
}

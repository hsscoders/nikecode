"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

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
        /* server pushed a wallet change (recharge approved, income,
           commission...) — refetch once and fan out via CustomEvent */
        sock.on("wallet:refresh", async () => {
          try {
            const t = localStorage.getItem("zapto_token");
            if (!t) return;
            const r = await window.fetch("/api/wallet", {
              headers: { Authorization: "Bearer " + t },
            });
            const d = await r.json();
            if (d.success && d.wallet)
              window.dispatchEvent(
                new CustomEvent("zapto:wallet", { detail: d.wallet })
              );
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

    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await orig(...args);
      try {
        const url =
          typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
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
          localStorage.removeItem("zapto_token");
          localStorage.removeItem("zapto_phone");
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

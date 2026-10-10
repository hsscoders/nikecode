"use client";

import { useEffect } from "react";

/* Global JWT guard — kisi bhi page par authed API 401 (expired/invalid
   token) return kare to token clear karke /login?expired=1 bhej do.
   Login/register/auto-login pages exclude hain (wahan 401 = galat
   password hota hai, redirect loop nahi banana). */
export default function GlobalAuthGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
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
          window.location.replace("/login?expired=1");
        }
      } catch (e) {}
      return res;
    };
  }, []);

  return null;
}

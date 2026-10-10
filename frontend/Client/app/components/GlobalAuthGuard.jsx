"use client";

import { useEffect } from "react";

/* Global JWT guard — when an authed API returns 401 (expired/invalid
   token) on any page, clear the token and send the user to /login?expired=1.
   Login/register/auto-login pages are excluded (there a 401 just means a
   wrong password — no redirect loops). */
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

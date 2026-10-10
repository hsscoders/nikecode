"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import logo from "../../public/aramco-logo.png";
import { clearUserSession } from "../components/liveCache";

/* One-click login — opened by the admin panel: /auto-login?code=...
   The one-time code is exchanged for a normal 7-day session token. */

function AutoLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState("");

  /* page title */
  useEffect(() => {
    document.title = "Auto Login";
  }, []);

  useEffect(() => {
    const code = sp.get("code") || "";
    if (!code) {
      setError("Invalid login link — redirecting to login...");
      setTimeout(() => router.replace("/login"), 1200);
      return;
    }
    (async () => {
      try {
        /* wipe any previous account's cached data before switching */
        clearUserSession();
        const r = await fetch("/api/auth/auto-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const d = await r.json();
        if (!r.ok || !d.success || !d.token) {
          setError(d.message || "Invalid login link — redirecting to login...");
          setTimeout(() => router.replace("/login"), 1500);
          return;
        }
        localStorage.setItem("zapto_token", d.token);
        localStorage.setItem("zapto_phone", d.user ? d.user.phone : "");
        router.replace("/home");
      } catch (e) {
        setError("Network error — redirecting to login...");
        setTimeout(() => router.replace("/login"), 1500);
      }
    })();
  }, [sp, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[linear-gradient(135deg,var(--c-deeper)_0%,var(--c-primary)_55%,var(--c-primary2)_100%)] px-6">
      <div className="relative h-[74px] w-[74px] overflow-hidden rounded-full border-[3px] border-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.4)] ring-4 ring-gold/40">
        <Image src={logo} alt="Saudi Aramco" fill sizes="74px" className="object-cover" priority />
      </div>
      <div className="mt-4 font-display text-[24px] font-bold tracking-[0.5px] text-white">
        SAUDI ARAMCO
      </div>
      {error ? (
        <div className="mt-3 text-[13.5px] font-semibold text-white/70">{error}</div>
      ) : (
        <>
          <div className="mt-3 text-[13.5px] font-semibold text-white/70">
            Logging you in...
          </div>
          <div className="mt-5 h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-gold" />
        </>
      )}
    </div>
  );
}

export default function AutoLoginPage() {
  return (
    <Suspense fallback={null}>
      <AutoLoginInner />
    </Suspense>
  );
}

"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import logo from "../../public/zapto-logo.png";

/* One-click login — link sent from the admin panel: /auto-login?token=...&phone=... */

function AutoLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState(false);

  /* page title */
  useEffect(() => {
    document.title = "Auto Login";
  }, []);

  useEffect(() => {
    const token = sp.get("token");
    const phone = sp.get("phone") || "";
    if (!token) {
      setError(true);
      setTimeout(() => router.replace("/login"), 900);
      return;
    }
    localStorage.setItem("zapto_token", token);
    localStorage.setItem("zapto_phone", phone);
    setTimeout(() => router.replace("/home"), 700);
  }, [sp, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[linear-gradient(135deg,var(--c-deeper)_0%,var(--c-primary)_55%,var(--c-primary2)_100%)] px-6">
      <div className="relative h-[74px] w-[74px] overflow-hidden rounded-full border-[3px] border-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.4)] ring-4 ring-gold/40">
        <Image src={logo} alt="ZAPTO" fill sizes="74px" className="object-cover" priority />
      </div>
      <div className="mt-4 font-display text-[24px] font-bold tracking-[0.5px] text-white">
        ZAPTO
      </div>
      {error ? (
        <div className="mt-3 text-[13.5px] font-semibold text-white/70">
          Invalid login link — redirecting to login...
        </div>
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

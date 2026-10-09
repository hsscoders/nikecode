"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, LogOut, Sparkles } from "lucide-react";
import banner from "../../public/zapto-banner.png";
import logo from "../../public/zapto-logo.png";

const submitBtn =
  "mt-2.5 h-[50px] w-full cursor-pointer rounded-full bg-[linear-gradient(135deg,#7c1d33_0%,#93293f_55%,#7c1d33_100%)] font-display text-[19px] font-bold tracking-[0.4px] text-white shadow-[0_12px_26px_rgba(124,29,51,0.32),inset_0_1px_0_rgba(255,255,255,0.16)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] max-[360px]:h-[46px] max-[360px]:text-lg";

export default function HomePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setPhone(localStorage.getItem("zapto_phone") || "");
  }, [router]);

  const logout = () => {
    localStorage.removeItem("zapto_token");
    localStorage.removeItem("zapto_phone");
    router.push("/login");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full min-[520px]:max-w-[430px] flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:mb-10 min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* TOP BANNER */}
      <div className="relative overflow-hidden">
        <Image
          src={banner}
          alt="ZAPTO"
          priority
          className="banner-fade h-[clamp(118px,36vw,156px)] w-full object-cover max-[360px]:h-[112px]"
        />
      </div>

      {/* LOGO */}
      <div className="relative z-20 -mt-[38px] flex h-[76px] w-[76px] shrink-0 items-center justify-center self-center overflow-hidden rounded-full border-[3px] border-white bg-[#fdf7f2] shadow-[0_10px_24px_rgba(87,18,36,0.22),0_0_0_1px_rgba(212,169,79,0.55)] max-[360px]:-mt-[33px] max-[360px]:h-[66px] max-[360px]:w-[66px]">
        <Image
          src={logo}
          alt="ZAPTO logo"
          priority
          className="h-full w-full object-cover"
        />
      </div>

      {/* CARD */}
      <div className="mt-3.5 flex-1 rounded-t-[26px] bg-white px-5 pb-[30px] pt-7 shadow-[0_-6px_24px_rgba(87,18,36,0.06)] max-[360px]:rounded-t-[22px] max-[360px]:px-3.5 max-[360px]:pb-[26px] max-[360px]:pt-5">
        {/* WELCOME */}
        <h1 className="text-center font-display text-[26px] font-bold text-maroon-700">
          Welcome{phone ? "," : "!"}
        </h1>
        {phone && (
          <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-line-rose bg-[#fbf1f3] px-4 py-2">
            <Phone size={15} className="text-maroon-600" />
            <span className="text-sm font-semibold text-maroon-800">
              +91 {phone}
            </span>
          </div>
        )}

        {/* COMING SOON */}
        <div className="mt-7 rounded-2xl border border-line-rose bg-[#fdf7f8] px-5 py-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f7e3e7]">
            <Sparkles size={20} className="text-maroon-600" />
          </div>
          <p className="mt-3 font-display text-[17px] font-bold text-maroon-700">
            Home is on the way
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#7d6a6e]">
            Aapka dashboard yahan banega — games, wallet aur rewards ke saath.
            Stay tuned!
          </p>
        </div>

        {/* LOGOUT */}
        <button className={submitBtn} type="button" onClick={logout}>
          <span className="inline-flex items-center justify-center gap-2">
            <LogOut size={18} />
            Logout
          </span>
        </button>
      </div>
    </div>
  );
}

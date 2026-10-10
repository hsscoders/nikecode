"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Lock, Eye, EyeOff, Clock } from "lucide-react";
import banner from "../../public/zapto-banner.png";
import logo from "../../public/zapto-logo.png";

/* ===== Shared Tailwind blocks — dono pages consistent ===== */

const inputGroup =
  "mb-4 flex w-full items-center rounded-xl border-[1.5px] border-line-rose bg-white px-3.5 py-3 transition-all duration-150 focus-within:border-maroon-500 focus-within:ring-[3.5px] focus-within:ring-maroon-600/10 max-[360px]:px-3 max-[360px]:py-2.5";

const inputField =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink outline-none placeholder:text-[14.5px] placeholder:text-[#bd9fa6]";

const inputIcon = "mr-2.5 flex shrink-0 items-center text-icon-rose";

const tabBase =
  "pb-2 font-display text-[17px] font-bold tracking-[0.2px] transition-colors duration-200 max-[360px]:text-base";

const tabActive =
  "relative text-maroon-700 after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-[linear-gradient(90deg,#d4a94f,#7c1d33)]";

const tabInactive = "text-muted-rose hover:text-maroon-600";

const submitBtn =
  "mt-2.5 h-[50px] w-full cursor-pointer rounded-full bg-[linear-gradient(135deg,#7c1d33_0%,#93293f_55%,#7c1d33_100%)] font-display text-[19px] font-bold tracking-[0.4px] text-white shadow-[0_12px_26px_rgba(124,29,51,0.32),inset_0_1px_0_rgba(255,255,255,0.16)] transition-all duration-200 hover:brightness-[1.07] hover:shadow-[0_14px_30px_rgba(124,29,51,0.38),inset_0_1px_0_rgba(255,255,255,0.16)] active:scale-[0.98] max-[360px]:h-[46px] max-[360px]:text-lg";

function PasswordField({ id, name, Icon, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);

  return (
    <div className={inputGroup}>
      <span className={inputIcon}>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <input
        className={inputField}
        type={show ? "text" : "password"}
        id={id}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        className="-mr-1 flex shrink-0 cursor-pointer items-center rounded-lg p-1.5 text-icon-rose transition-colors duration-150 hover:text-maroon-600"
        onClick={() => setShow(!show)}
        aria-label="Toggle password visibility"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [phone, setPhone] = useState("");
  const [titles, setTitles] = useState({ login: "Login", register: "Register" });

  /* site settings — admin panel se titles (fail hone par default) */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (d.success && d.settings && d.settings.site)
          setTitles({
            login: d.settings.site.loginTitle || "Login",
            register: d.settings.site.registerTitle || "Register",
          });
      } catch (e) {}
    })();
  }, []);

  /* page title — Login/Register text */
  useEffect(() => {
    document.title = titles.login || "Login";
  }, [titles]);

  /* JWT session expired flag — interceptor se wapas aaya? */
  useEffect(() => {
    if (window.location.search.includes("expired=1")) setExpired(true);
  }, []);

  /* JWT fix — valid token already hai to seedha /home, invalid ho to clear */
  useEffect(() => {
    const t = localStorage.getItem("zapto_token");
    if (!t) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + t },
        });
        if (cancel) return;
        if (r.ok) {
          router.replace("/home");
        } else if (r.status === 401 || r.status === 403) {
          localStorage.removeItem("zapto_token");
          localStorage.removeItem("zapto_phone");
        }
      } catch (e) {}
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");

    /* client-side validation — server se pehle clear feedback */
    if (!/^[6-9]\d{9}$/.test(phone))
      return setError("Enter a valid 10-digit Indian mobile number");
    if (!password)
      return setError("Please enter your password");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Something went wrong, please try again");
        return;
      }
      localStorage.setItem("zapto_token", data.token);
      localStorage.setItem("zapto_phone", (data.user && data.user.phone) || "");
      router.replace("/home");
    } catch (err) {
      setError("Network error — please check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

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
      <div className="mt-3.5 flex-1 rounded-t-[26px] bg-white px-5 pb-[30px] pt-6 shadow-[0_-6px_24px_rgba(87,18,36,0.06)] max-[360px]:rounded-t-[22px] max-[360px]:px-3.5 max-[360px]:pb-[26px] max-[360px]:pt-5">
        {/* TABS */}
        <div className="mb-6 flex items-baseline justify-between">
          <Link href="/login" className={`${tabBase} ${tabActive}`}>
            {titles.login}
          </Link>
          <Link href="/register" className={`${tabBase} ${tabInactive}`}>
            {titles.register}
          </Link>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} noValidate>
          {/* SESSION EXPIRED BANNER */}
          {expired && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#f1d3a7] bg-[#fdf6ec] px-4 py-3 text-[13.5px] font-semibold text-[#9a6b1f]">
              <Clock size={15} className="shrink-0" />
              Session expired — please login again
            </div>
          )}

          {/* PHONE */}
          <div className={inputGroup}>
            <div className="mr-2.5 flex min-w-16 items-center gap-1.5 border-r border-line-rose pr-2.5">
              <Phone size={16} strokeWidth={2.2} className="text-maroon-600" />
              <span className="text-sm font-semibold text-maroon-800">
                +91
              </span>
            </div>
            <input
              className={inputField}
              type="tel"
              name="phone"
              placeholder="Enter phone number"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              autoFocus
              required
            />
          </div>

          {/* PASSWORD */}
          <PasswordField
            id="password"
            name="password"
            Icon={Lock}
            placeholder="Enter password"
            autoComplete="current-password"
          />

          {/* ERROR */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] leading-relaxed text-red-700">
              {error}
            </div>
          )}

          {/* BUTTON */}
          <button
            className={`${submitBtn} disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100`}
            type="submit"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Login"}
          </button>

          {/* FOOTER */}
          <div className="mt-[18px] text-center text-[13.5px] text-[#7d6a6e]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-maroon-700 hover:underline"
            >
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

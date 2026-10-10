"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import logo from "../../../public/admin-logo.png";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Something went wrong, please try again");
        return;
      }
      localStorage.setItem("admin_token", data.token);
      router.replace("/admin");
    } catch (err) {
      setError("Network error — please check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#42091a_0%,#571224_45%,#6b1830_80%,#93293f_100%)] p-5">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-[300px] w-[300px] rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-[340px] w-[340px] rounded-full bg-maroon-500/25 blur-3xl" />

      <div className="relative w-full max-w-[410px]">
        {/* Logo row */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative h-[74px] w-[74px] overflow-hidden rounded-full border-[3px] border-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.4)] ring-4 ring-gold/40">
            <Image src={logo} alt="Logo" fill sizes="74px" className="object-cover" priority />
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[2px] text-gold">
            <ShieldCheck size={13} />
            Master Admin Panel
          </div>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] animate-[pop-in_0.25s_ease]">
          <div className="bg-[linear-gradient(135deg,#7c1d33_0%,#93293f_100%)] px-7 pb-5 pt-6 text-center">
            <div className="font-display text-[20px] font-bold text-white">Admin Login</div>
            <div className="mt-1 text-[12px] font-medium text-white/60">
              Sign in to manage the platform
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="px-7 py-6">
            {/* USERNAME */}
            <div className="mb-4 flex w-full items-center rounded-xl border-[1.5px] border-line-rose bg-white px-3.5 py-3 transition-all duration-150 focus-within:border-maroon-500 focus-within:ring-[3.5px] focus-within:ring-maroon-600/10">
              <User size={17} strokeWidth={2.2} className="mr-2.5 shrink-0 text-icon-rose" />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-[#bd9fa6]"
                type="text"
                placeholder="Enter admin username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="mb-4 flex w-full items-center rounded-xl border-[1.5px] border-line-rose bg-white px-3.5 py-3 transition-all duration-150 focus-within:border-maroon-500 focus-within:ring-[3.5px] focus-within:ring-maroon-600/10">
              <Lock size={17} strokeWidth={2.2} className="mr-2.5 shrink-0 text-icon-rose" />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-[#bd9fa6]"
                type={show ? "text" : "password"}
                placeholder="Enter admin password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="-mr-1 flex shrink-0 cursor-pointer items-center rounded-lg p-1.5 text-icon-rose transition-colors hover:text-maroon-600"
                onClick={() => setShow(!show)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {/* ERROR */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-700">
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button
              className="mt-1 h-[50px] w-full cursor-pointer rounded-full bg-[linear-gradient(135deg,#7c1d33_0%,#93293f_55%,#7c1d33_100%)] font-display text-[17px] font-bold tracking-[0.4px] text-white shadow-[0_12px_26px_rgba(124,29,51,0.32)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login to Dashboard"}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center text-[11.5px] font-medium text-white/35">
          Master Admin · v1.0
        </div>
      </div>
    </div>
  );
}

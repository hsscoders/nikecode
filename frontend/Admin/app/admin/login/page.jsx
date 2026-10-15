"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(160deg,var(--color-page)_0%,var(--color-tint2)_45%,var(--color-tint)_100%)] p-5">
      {/* Soft brand glows — follow the live theme tokens */}
      <div className="pointer-events-none absolute -left-28 -top-28 h-[340px] w-[340px] rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[380px] w-[380px] rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute left-[55%] top-[8%] h-[260px] w-[260px] rounded-full bg-[var(--color-line)]/60 blur-3xl" />

      {/* Subtle dotted grid — fades out towards the edges */}
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(var(--color-line)_1.1px,transparent_1.1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]" />

      <div className="relative w-full max-w-[410px]">
        {/* Logo row */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative h-[76px] w-[76px] overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_18px_44px_rgba(30,27,75,0.14)] ring-2 ring-brand-500/40">
            <Image src={logo} alt="Logo" fill sizes="76px" className="object-cover" priority />
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[1.8px] text-brand-700 shadow-sm backdrop-blur">
            <ShieldCheck size={12} className="text-brand-600" />
            Master Admin Panel
          </div>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-[26px] border border-line/80 bg-white/90 shadow-[0_30px_80px_rgba(49,46,129,0.12)] backdrop-blur-xl animate-[pop-in_0.25s_ease]">
          <div className="px-7 pb-1 pt-7 text-center">
            <div className="font-display text-[23px] font-bold text-ink">
              Welcome back
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-muted">
              Sign in to manage the platform
            </div>
            <div className="accent-bar mx-auto mt-3 h-[3px] w-10 rounded-full" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="px-7 pb-7 pt-5">
            {/* USERNAME */}
            <label
              htmlFor="admin-username"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-muted"
            >
              Username
            </label>
            <div className="mb-4 flex w-full items-center rounded-2xl border-[1.5px] border-line bg-[#fbf7f8] px-4 py-3.5 transition-all duration-150 focus-within:border-brand-500 focus-within:bg-white focus-within:ring-[4px] focus-within:ring-brand-600/10">
              <User size={17} strokeWidth={2.2} className="mr-2.5 shrink-0 text-icon" />
              <input
                id="admin-username"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted"
                type="text"
                placeholder="Enter admin username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {/* PASSWORD */}
            <label
              htmlFor="admin-password"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-muted"
            >
              Password
            </label>
            <div className="mb-4 flex w-full items-center rounded-2xl border-[1.5px] border-line bg-[#fbf7f8] px-4 py-3.5 transition-all duration-150 focus-within:border-brand-500 focus-within:bg-white focus-within:ring-[4px] focus-within:ring-brand-600/10">
              <Lock size={17} strokeWidth={2.2} className="mr-2.5 shrink-0 text-icon" />
              <input
                id="admin-password"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted"
                type={show ? "text" : "password"}
                placeholder="Enter admin password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="-mr-1 flex shrink-0 cursor-pointer items-center rounded-lg p-1.5 text-icon transition-colors hover:text-brand-600"
                onClick={() => setShow(!show)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {/* ERROR */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 sm:px-4 sm:py-3 text-[13px] leading-relaxed text-red-700">
                {error}
              </div>
            )}

            {/* SUBMIT — theme-driven gradient (admin-btn-hero) */}
            <button
              className="admin-btn-hero mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  Login to Dashboard
                  <ArrowRight size={18} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>

          {/* Card footer strip */}
          <div className="flex items-center justify-center gap-1.5 border-t border-line bg-[var(--color-tint)]/70 py-3.5 text-[11px] font-semibold text-muted">
            <Lock size={12} className="text-muted" />
            Secure admin access
          </div>
        </div>

        <div className="mt-5 text-center text-[11.5px] font-medium text-muted">
          Master Admin · v1.0
        </div>
      </div>
    </div>
  );
}

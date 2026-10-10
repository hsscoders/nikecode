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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#f7f9fc_0%,#eef1f8_45%,#f1effa_100%)] p-5">
      {/* Soft pastel glows */}
      <div className="pointer-events-none absolute -left-28 -top-28 h-[340px] w-[340px] rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[380px] w-[380px] rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[55%] top-[8%] h-[260px] w-[260px] rounded-full bg-violet-200/40 blur-3xl" />

      {/* Subtle dotted grid — fades out towards the edges */}
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(#c7cede_1.1px,transparent_1.1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]" />

      <div className="relative w-full max-w-[410px]">
        {/* Logo row */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative h-[76px] w-[76px] overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.14)]">
            <Image src={logo} alt="Logo" fill sizes="76px" className="object-cover" priority />
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[1.8px] text-slate-500 shadow-sm backdrop-blur">
            <ShieldCheck size={12} className="text-indigo-500" />
            Master Admin Panel
          </div>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl animate-[pop-in_0.25s_ease]">
          <div className="px-7 pb-1 pt-7 text-center">
            <div className="font-display text-[23px] font-bold text-slate-900">
              Welcome back
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-slate-500">
              Sign in to manage the platform
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="px-7 pb-7 pt-5">
            {/* USERNAME */}
            <label
              htmlFor="admin-username"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-slate-400"
            >
              Username
            </label>
            <div className="mb-4 flex w-full items-center rounded-2xl border-[1.5px] border-slate-200 bg-slate-50/80 px-4 py-3.5 transition-all duration-150 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-[4px] focus-within:ring-indigo-500/10">
              <User size={17} strokeWidth={2.2} className="mr-2.5 shrink-0 text-slate-400" />
              <input
                id="admin-username"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
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
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-slate-400"
            >
              Password
            </label>
            <div className="mb-4 flex w-full items-center rounded-2xl border-[1.5px] border-slate-200 bg-slate-50/80 px-4 py-3.5 transition-all duration-150 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-[4px] focus-within:ring-indigo-500/10">
              <Lock size={17} strokeWidth={2.2} className="mr-2.5 shrink-0 text-slate-400" />
              <input
                id="admin-password"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
                type={show ? "text" : "password"}
                placeholder="Enter admin password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="-mr-1 flex shrink-0 cursor-pointer items-center rounded-lg p-1.5 text-slate-400 transition-colors hover:text-indigo-500"
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
              className="mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4338ca_0%,#6366f1_55%,#4f46e5_100%)] text-[16px] font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.32)] transition-all duration-200 hover:brightness-[1.06] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/70 py-3.5 text-[11px] font-semibold text-slate-400">
            <Lock size={12} className="text-slate-300" />
            Secure admin access
          </div>
        </div>

        <div className="mt-5 text-center text-[11.5px] font-medium text-slate-400">
          Master Admin · v1.0
        </div>
      </div>
    </div>
  );
}

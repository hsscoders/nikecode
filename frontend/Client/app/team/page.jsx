"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  IndianRupee,
  ReceiptText,
  Users,
  User,
  Wallet,
  LogOut,
  CircleCheck,
  UsersRound,
} from "lucide-react";
import logo from "../../public/zapto-logo.png";
import teamBanner from "../../public/zapto-team-banner.png";
import BottomNav from "../components/BottomNav";

/* ================= DEMO DATA (the team API will take over later) ================= */

const LEVEL_MEMBERS = {
  1: [
    { phone: "9876543210", date: "12 Sep 2025", recharge: 1100, withdrawal: 250, refs: 2 },
    { phone: "9123456780", date: "28 Sep 2025", recharge: 600, withdrawal: 0, refs: 0 },
    { phone: "9988776655", date: "03 Oct 2025", recharge: 2500, withdrawal: 900, refs: 1 },
  ],
  2: [
    { phone: "9090909090", date: "18 Sep 2025", recharge: 600, withdrawal: 100, refs: 1 },
    { phone: "9812345678", date: "01 Oct 2025", recharge: 1100, withdrawal: 0, refs: 0 },
  ],
  3: [],
};

/* Commission % — matches the invite page levels (25 / 3 / 2) */
const LEVEL_COMMISSION = { 1: 0.25, 2: 0.03, 3: 0.02 };

/* Derived stats — all calculated from the demo data */
const lvRecharge = (lv) =>
  (LEVEL_MEMBERS[lv] || []).reduce((s, m) => s + m.recharge, 0);

const teamSize = Object.values(LEVEL_MEMBERS).reduce((s, l) => s + l.length, 0);
const teamRecharge = [1, 2, 3].reduce((s, lv) => s + lvRecharge(lv), 0);
const teamCommission = [1, 2, 3].reduce(
  (s, lv) => s + lvRecharge(lv) * LEVEL_COMMISSION[lv],
  0
);

/* ================= HELPERS ================= */

const fmt2 = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const maskPhone = (p) => (p && p.length >= 6 ? p.slice(0, 3) + "***" + p.slice(-3) : p);

const cardShadow = "shadow-[0_4px_24px_rgba(87,18,36,0.08)]";

/* ================= SMALL PARTS ================= */

function CenterAlert({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-1/2 z-[80] flex min-w-[180px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2.5 rounded-full bg-maroon-950 px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_var(--s-alert)] transition-all duration-200 ${
        message
          ? "pointer-events-auto scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0"
      }`}
    >
      <CircleCheck size={18} className="shrink-0 text-gold" />
      <span className="truncate">{message}</span>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

export default function TeamPage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Team";
  }, []);
  const [level, setLevel] = useState(1);
  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef(null);

  /* token guard — /team stays locked without login */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  const showAlert = (msg) => {
    clearTimeout(alertTimer.current);
    setAlertMsg("");
    requestAnimationFrame(() => {
      setAlertMsg(msg);
      alertTimer.current = setTimeout(() => setAlertMsg(""), 2000);
    });
  };

  const logout = () => {
    localStorage.removeItem("zapto_token");
    localStorage.removeItem("zapto_phone");
    router.replace("/login");
  };

  const members = LEVEL_MEMBERS[level] || [];

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell — same as home/invite/recharge) ===== */}
      <header className="flex items-center justify-between bg-[linear-gradient(135deg,var(--c-deep)_0%,var(--c-primary)_55%,var(--c-primary2)_100%)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative h-[34px] w-[34px] overflow-hidden rounded-full ring-2 ring-gold/60">
            <Image src={logo} alt="ZAPTO logo" fill sizes="34px" className="object-cover" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-none tracking-[0.5px] text-white">
              ZAPTO
            </div>
            <div className="mt-0.5 text-[10px] font-medium leading-none text-gold">
              Earn daily, withdraw daily
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-white/10 px-3 py-1.5">
            <Wallet size={14} className="text-gold" />
            <span className="text-[13px] font-bold text-white">{fmt2(0)}</span>
          </div>
          <button
            type="button"
            aria-label="Logout"
            onClick={logout}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-white/10 text-white/75 transition-colors hover:bg-white/20 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ===== TEAM HERO (gradient section — stats + level pills) ===== */}
      <section className="bg-[linear-gradient(180deg,var(--c-primary2)_0%,var(--c-primary)_45%,var(--c-deep)_100%)] px-3.5 pb-5">
        {/* team banner */}
        <div className="relative mt-0 h-[150px] overflow-hidden rounded-b-[18px] max-[360px]:h-[125px]">
          <Image
            src={teamBanner}
            alt="My team"
            fill
            priority
            sizes="(max-width: 520px) 100vw, 430px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--s-alert)_0%,transparent_60%)]" />
        </div>

        {/* stats — Team Commission / Team Recharge / Team Members */}
        <div className="mt-3 grid grid-cols-3 gap-2 max-[360px]:gap-1.5">
          {[
            { lbl: "Team Commission", val: fmt2(teamCommission) },
            { lbl: "Team Recharge", val: fmt2(teamRecharge) },
            { lbl: "Team Members", val: String(teamSize) },
          ].map(({ lbl, val }) => (
            <div
              key={lbl}
              className="rounded-[16px] bg-white/12 px-1.5 py-3 text-center backdrop-blur-sm max-[360px]:py-2.5"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.5px] text-white/75 max-[360px]:text-[8px]">
                {lbl}
              </div>
              <div className="mt-1 text-[14px] font-bold leading-none text-white max-[360px]:text-[12px]">
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* level pills — Level 1 / 2 / 3 (per-level recharge) */}
        <div className="mt-3 flex gap-1.5 rounded-full bg-black/20 p-1">
          {[1, 2, 3].map((lv) => {
            const active = level === lv;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                className={`flex-1 cursor-pointer rounded-full px-1 py-2 text-center transition-all duration-200 ${
                  active ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.18)]" : ""
                }`}
              >
                <div
                  className={`text-[9px] font-bold uppercase tracking-[0.6px] ${
                    active ? "text-maroon-700" : "text-white/70"
                  }`}
                >
                  Level {lv}
                </div>
                <div
                  className={`mt-0.5 text-[13px] font-extrabold leading-none ${
                    active ? "text-maroon-700" : "text-white"
                  }`}
                >
                  {fmt2(lvRecharge(lv))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== MEMBERS GRID ===== */}
      <div className="flex-1 px-3.5 pb-28 pt-4">
        {members.length === 0 ? (
          /* empty state — reference style */
          <div className={`rounded-[20px] border border-line-rose bg-white px-5 py-12 text-center ${cardShadow}`}>
            <UsersRound
              size={52}
              strokeWidth={1.4}
              className="mx-auto text-line-rose"
            />
            <div className="mt-4 text-[15px] font-medium text-muted-rose">
              No members in this tier yet
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {members.map((m) => (
              <div
                key={m.phone}
                className={`flex gap-3.5 rounded-[20px] border border-line-rose bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(87,18,36,0.12)] ${cardShadow} max-[360px]:p-3.5`}
              >
                {/* avatar */}
                <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[16px] border-2 border-gold/45 bg-[var(--c-tint)] max-[360px]:h-[46px] max-[360px]:w-[46px]">
                  <Image src={logo} alt="Member avatar" fill sizes="52px" className="object-cover" />
                </div>

                {/* details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[14px] font-bold tracking-[-0.2px] text-ink">
                      {maskPhone(m.phone)}
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--c-tint)] px-2.5 py-1 text-[10px] font-bold text-maroon-700">
                      {m.date}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-end justify-between gap-1">
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-muted-rose">
                        Recharge
                      </div>
                      <div className="mt-0.5 text-[13px] font-extrabold text-maroon-700">
                        {fmt2(m.recharge)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-muted-rose">
                        Withdrawal
                      </div>
                      <div className="mt-0.5 text-[13px] font-extrabold text-[#7d6a6e]">
                        {fmt2(m.withdrawal)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-muted-rose">
                        Referrals
                      </div>
                      <div className="mt-0.5 text-[13px] font-extrabold text-[#a9791c]">
                        {m.refs}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

            <BottomNav active={-1} />

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

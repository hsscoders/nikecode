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
  ShoppingBag,
  Crown,
  Zap,
  CalendarDays,
} from "lucide-react";
import logo from "../../public/aramco-logo.png";
import planDaily from "../../public/plan-daily.png";
import planVip from "../../public/plan-vip.png";
import { logoutUser, readCache, writeCache } from "../components/liveCache";
import BottomNav from "../components/BottomNav";
import useLive from "../components/useLive";

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹ " +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,var(--c-primary)_0%,var(--c-primary2)_55%,var(--c-primary)_100%)] shadow-[0_10px_24px_var(--s-btn)]";

const card =
  "rounded-[18px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.07)]";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* cycle progress — completed plans are 100%, active ones derive
   day + percent from the purchase date (1 day = 86400000 ms) */
const dayInfo = (o) => {
  const cycle = Number(o.cycle) || 1;
  if ((o.status || "Active") === "Completed") return { day: cycle, pct: 100, done: true };
  const elapsed = Math.floor((Date.now() - new Date(o.boughtAt).getTime()) / 86400000);
  const day = Math.min(cycle, Math.max(1, elapsed + 1));
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / cycle) * 100)));
  return { day, pct, done: false };
};

/* ================= SMALL PARTS ================= */

/* Centered alert — same as invite/recharge/team (2s auto-hide) */
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

/* Order card — specs like the home plan card (Price / Daily / Total Return) */
function OrderCard({ order }) {
  const info = dayInfo(order);
  return (
    <div
      className={`${card} p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(87,18,36,0.12)] max-[360px]:p-3.5`}
    >
      {/* plan + status */}
      <div className="flex items-center gap-3">
        <div
          className={`relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[16px] max-[360px]:h-[46px] max-[360px]:w-[46px] ${
            order.vip ? "ring-2 ring-gold/70" : "ring-1 ring-line-rose"
          }`}
        >
          <Image
            src={order.vip ? planVip : planDaily}
            alt={order.name}
            fill
            sizes="54px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[16px] font-bold text-ink">
              {order.name}
            </span>
            {order.vip ? (
              <Crown size={14} strokeWidth={2.3} className="shrink-0 text-[#a9791c]" />
            ) : (
              <Zap size={14} strokeWidth={2.3} className="shrink-0 text-maroon-600" />
            )}
          </div>
          <div className="mt-1 truncate text-[11px] font-medium text-muted-rose">
            Order ID: {order.id}
          </div>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
            order.status === "Completed"
              ? "bg-[#fdf6e4] text-[#a9791c]"
              : "bg-[#eafaf0] text-[#16a34a]"
          }`}
        >
          <span
            className={`h-[6px] w-[6px] rounded-full ${
              order.status === "Completed" ? "bg-[#a9791c]" : "bg-[#16a34a]"
            }`}
          />
          {order.status === "Completed" ? "Completed" : "Active"}
        </span>
      </div>

      {/* specs — 3 col (color coding like the plan card's 2x2) */}
      <div className="mt-3.5 grid grid-cols-3 rounded-[12px] border border-line-rose/70 bg-[var(--c-tint)] p-2.5 max-[360px]:p-2">
        {[
          { lbl: "Price", val: fmt(order.price), cls: "text-maroon-700" },
          { lbl: "Daily", val: fmt(order.daily), cls: "text-[#16a34a]" },
          { lbl: "Total Return", val: fmt(order.total), cls: "text-[#a9791c]" },
        ].map(({ lbl, val, cls }, i) => (
          <div key={lbl} className={`text-center ${i > 0 ? "border-l border-line-rose" : ""}`}>
            <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted-rose">
              {lbl}
            </div>
            <div className={`mt-0.5 text-[13px] font-extrabold leading-none ${cls}`}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* cycle progress — fills toward 100% as days pass */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-muted-rose">
            Cycle Progress
          </span>
          <span
            className={`text-[10.5px] font-extrabold ${
              info.done ? "text-[#16a34a]" : "text-maroon-700"
            }`}
          >
            {info.done
              ? "Completed · 100%"
              : `Day ${info.day} of ${order.cycle} · ${info.pct}%`}
          </span>
        </div>
        <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--c-tint2)]">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              info.done
                ? "bg-[#16a34a]"
                : "bg-[linear-gradient(90deg,var(--c-primary),var(--c-accent))]"
            }`}
            style={{ width: `${info.pct}%` }}
          />
        </div>
      </div>

      {/* footer — purchase date + cycle */}
      <div className="mt-3 flex items-center justify-between border-t border-line-rose pt-3">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-rose">
          <CalendarDays size={13} className="text-icon-rose" />
          Purchased {fmtDate(order.boughtAt)}
        </div>
        <div className="text-[11.5px] font-bold text-maroon-700">{order.cycle} days cycle</div>
      </div>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

export default function OrderedPage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Records";
  }, []);
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [filter, setFilter] = useState("All"); /* All | Active | Completed */
  const alertTimer = useRef(null);

  /* token guard + orders load — instant paint from the orders cache, then
     the SERVER list (truth: active/completed status, works on any device) */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const cached = readCache("invests");
    if (Array.isArray(cached) && cached.length) {
      setOrders(cached);
    }
    setReady(true);
    (async () => {
      try {
        const r = await fetch("/api/invests", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && Array.isArray(d.invests)) {
          setOrders(d.invests);
          writeCache("invests", d.invests);
        }
      } catch (e) {}
    })();
  }, [router]);

  /* LIVE — a new plan purchase (from this or another tab) → refetch from the
     server. The cache read alone was dead here: sessionStorage is per-tab and
     nothing on this page rewrote it, so push-driven updates never appeared. */
  useLive("activity:update", () => {
    (async () => {
      try {
        const token = localStorage.getItem("zapto_token");
        if (!token) return;
        const r = await fetch("/api/invests", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && Array.isArray(d.invests)) {
          setOrders(d.invests);
          writeCache("invests", d.invests);
        }
      } catch (e) {}
    })();
  });

  /* Centered alert — 2s auto-hide */
  const showAlert = (msg) => {
    clearTimeout(alertTimer.current);
    setAlertMsg("");
    requestAnimationFrame(() => {
      setAlertMsg(msg);
      alertTimer.current = setTimeout(() => setAlertMsg(""), 2000);
    });
  };

  const logout = () => {
    logoutUser();
    router.replace("/login");
  };

  /* summary — invested = every order ever; daily income = ACTIVE plans only
     (a completed cycle stops paying) */
  const totalInvested = orders.reduce((s, o) => s + (Number(o.price) || 0), 0);
  const dailyIncome = orders
    .filter((o) => (o.status || "Active") === "Active")
    .reduce((s, o) => s + (Number(o.daily) || 0), 0);
  const activeCount = orders.filter((o) => (o.status || "Active") === "Active").length;
  const completedCount = orders.length - activeCount;
  const shown =
    filter === "All" ? orders : orders.filter((o) => (o.status || "Active") === filter);

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col">
      {/* ===== HEADER (app shell — same as the other pages) ===== */}
      <header className="flex items-center justify-between bg-[linear-gradient(135deg,var(--c-deep)_0%,var(--c-primary)_55%,var(--c-primary2)_100%)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative h-[34px] w-[34px] overflow-hidden rounded-full ring-2 ring-gold/60">
            <Image src={logo} alt="Saudi Aramco logo" fill sizes="34px" className="object-cover" />
          </div>
          <div>
            <div className="font-display text-[17px] font-bold leading-none tracking-[0.5px] text-white">
              SAUDI ARAMCO
            </div>
            <div className="mt-0.5 text-[10px] font-medium leading-none text-gold">
              Earn daily, withdraw daily
            </div>
          </div>
        </div>
      </header>

      {/* ===== CONTENT ===== */}
      <div className="flex-1 bg-[var(--c-bg)] px-3.5 pb-28 pt-3.5">
        {/* --- PAGE TITLE --- */}
        <div className="flex items-center justify-between">
          <div className="font-display text-[20px] font-bold text-ink">My Orders</div>
          {ready && orders.length > 0 && (
            <span className="rounded-full bg-[var(--c-tint2)] px-3 py-1 text-[11px] font-bold text-maroon-700">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </span>
          )}
        </div>

        {/* --- SUMMARY (header-matched gradient — stays bright on every theme) --- */}
        <div className="relative mt-3 overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(135deg,var(--c-deep)_0%,var(--c-primary)_55%,var(--c-primary2)_100%)] px-2 py-3.5 shadow-[0_8px_24px_var(--s-btn)]">
          <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-[radial-gradient(circle,var(--c-accent)_0%,transparent_70%)] opacity-[0.16]" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,var(--c-primary3)_0%,transparent_70%)] opacity-30" />
          <div className="relative grid grid-cols-3">
            {[
              { lbl: "Total Orders", val: String(orders.length), Icon: ReceiptText },
              { lbl: "Total Invested", val: fmt(totalInvested), Icon: IndianRupee },
              { lbl: "Daily Income", val: fmt(dailyIncome), gold: true, Icon: Zap },
            ].map(({ lbl, val, gold, Icon }, i) => (
              <div
                key={lbl}
                className={`flex flex-col items-center gap-1.5 px-1 text-center ${
                  i > 0 ? "border-l border-white/10" : ""
                }`}
              >
                <div
                  className={`grid h-[26px] w-[26px] place-items-center rounded-[9px] ${
                    gold ? "bg-gold/15" : "bg-white/10"
                  }`}
                >
                  <Icon size={14} strokeWidth={2.2} className={gold ? "text-gold" : "text-white/85"} />
                </div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.5px] text-white/75">
                  {lbl}
                </div>
                <div
                  className={`text-[14px] font-bold leading-none max-[360px]:text-[12px] ${
                    gold ? "text-gold" : "text-white"
                  }`}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- FILTER CHIPS (All / Active / Completed with counts) --- */}
        {ready && orders.length > 0 && (
          <div className="mt-3 flex gap-2">
            {["All", "Active", "Completed"].map((f) => {
              const n =
                f === "All" ? orders.length : f === "Active" ? activeCount : completedCount;
              if (n === 0 && f !== "All") return null;
              const on = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-all duration-150 active:scale-[0.96] ${
                    on
                      ? "border-maroon-700 bg-maroon-700 text-white shadow-[0_4px_12px_var(--s-btn)]"
                      : "border-line-rose bg-white text-muted-rose"
                  }`}
                >
                  {f}
                  <span
                    className={`grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[9.5px] font-extrabold ${
                      on ? "bg-gold/25 text-gold" : "bg-[var(--c-tint2)] text-maroon-700"
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* --- ORDERS LIST / EMPTY STATES --- */}
        {!ready ? null : orders.length === 0 ? (
          <div className={`${card} mt-3.5 flex flex-col items-center px-6 py-12 text-center`}>
            <div className="grid h-[72px] w-[72px] place-items-center rounded-[22px] bg-[var(--c-tint2)]">
              <ShoppingBag size={34} strokeWidth={1.7} className="text-maroon-600" />
            </div>
            <div className="mt-4 font-display text-[18px] font-bold text-ink">No orders yet</div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-rose">
              Buy a plan from the home page and your
              <br />
              purchases will appear here.
            </p>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className={`mt-5 cursor-pointer rounded-[14px] px-7 py-3 text-[14px] font-extrabold text-white transition-all duration-150 active:scale-[0.97] ${gradientBtn}`}
            >
              Browse Plans
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className={`${card} mt-3.5 flex flex-col items-center px-6 py-10 text-center`}>
            <div className="grid h-[58px] w-[58px] place-items-center rounded-[18px] bg-[var(--c-tint2)]">
              <ReceiptText size={26} strokeWidth={1.8} className="text-maroon-600" />
            </div>
            <div className="mt-3.5 font-display text-[16px] font-bold text-ink">
              No {filter.toLowerCase()} orders
            </div>
            <p className="mt-1 text-[12.5px] text-muted-rose">
              Switch the filter above to see your other plans.
            </p>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-col gap-3.5">
            {shown.map((o, i) => (
              <div
                key={o.id}
                className="rise-in"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <OrderCard order={o} />
              </div>
            ))}
          </div>
        )}
      </div>

            <BottomNav active={3} />

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

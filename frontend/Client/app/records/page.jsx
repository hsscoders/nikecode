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
import logo from "../../public/zapto-logo.png";
import planDaily from "../../public/plan-daily.png";
import planVip from "../../public/plan-vip.png";

const NAV_ITEMS = [
  { label: "Home", Icon: Home },
  { label: "Recharge", Icon: IndianRupee },
  { label: "Invite", Icon: Users },
  { label: "Records", Icon: ReceiptText },
  { label: "Account", Icon: User },
];

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,#7c1d33_0%,#93293f_55%,#7c1d33_100%)] shadow-[0_10px_24px_rgba(124,29,51,0.35)]";

const card =
  "rounded-[18px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.07)]";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ================= SMALL PARTS ================= */

/* Centered alert — invite/recharge/team jaisa (2s auto-hide) */
function CenterAlert({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-1/2 z-[80] flex min-w-[180px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2.5 rounded-full bg-maroon-950 px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(66,9,26,0.4)] transition-all duration-200 ${
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

/* Order card — home ke plan card jaisi specs (Price / Daily / Total Return) */
function OrderCard({ order }) {
  return (
    <div
      className={`${card} p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(87,18,36,0.12)] max-[360px]:p-3.5`}
    >
      {/* plan + status */}
      <div className="flex items-center gap-3">
        <div className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[16px] ring-1 ring-line-rose max-[360px]:h-[46px] max-[360px]:w-[46px]">
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
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eafaf0] px-2.5 py-1 text-[10px] font-extrabold text-[#16a34a]">
          <span className="h-[6px] w-[6px] rounded-full bg-[#16a34a]" />
          Active
        </span>
      </div>

      {/* specs — 3 col (plan card ke 2x2 jaisa color coding) */}
      <div className="mt-3.5 grid grid-cols-3 rounded-[12px] border border-line-rose/70 bg-[#fbf1f3] p-2.5 max-[360px]:p-2">
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
  const alertTimer = useRef(null);

  /* token guard + orders load (localStorage — order API baad me) */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      setOrders(JSON.parse(localStorage.getItem("zapto_orders") || "[]"));
    } catch {
      setOrders([]);
    }
    setReady(true);
  }, [router]);

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
    localStorage.removeItem("zapto_token");
    localStorage.removeItem("zapto_phone");
    router.replace("/login");
  };

  /* summary — orders se derive */
  const totalInvested = orders.reduce((s, o) => s + (Number(o.price) || 0), 0);
  const dailyIncome = orders.reduce((s, o) => s + (Number(o.daily) || 0), 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell — baaki pages jaisa) ===== */}
      <header className="flex items-center justify-between bg-[linear-gradient(135deg,#6b1830_0%,#7c1d33_55%,#93293f_100%)] px-4 py-3">
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
            <span className="text-[13px] font-bold text-white">{fmt(0)}</span>
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

      {/* ===== CONTENT ===== */}
      <div className="flex-1 bg-[#faf6f7] px-3.5 pb-28 pt-3.5">
        {/* --- PAGE TITLE --- */}
        <div className="flex items-center justify-between">
          <div className="font-display text-[20px] font-bold text-ink">My Orders</div>
          {ready && orders.length > 0 && (
            <span className="rounded-full bg-[#f7e3e7] px-3 py-1 text-[11px] font-bold text-maroon-700">
              {orders.length} {orders.length === 1 ? "plan" : "plans"} active
            </span>
          )}
        </div>

        {/* --- SUMMARY (team page stats jaisa) --- */}
        <div className="mt-3 rounded-[20px] border border-maroon-900 bg-maroon-950 px-2 py-3.5 shadow-[0_8px_24px_rgba(66,9,26,0.28)]">
          <div className="grid grid-cols-3">
            {[
              { lbl: "Total Orders", val: String(orders.length) },
              { lbl: "Total Invested", val: fmt(totalInvested) },
              { lbl: "Daily Income", val: fmt(dailyIncome), gold: true },
            ].map(({ lbl, val, gold }, i) => (
              <div
                key={lbl}
                className={`flex flex-col items-center gap-1 px-1 text-center ${
                  i > 0 ? "border-l border-white/10" : ""
                }`}
              >
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

        {/* --- ORDERS LIST / EMPTY STATE --- */}
        {!ready ? null : orders.length === 0 ? (
          <div className={`${card} mt-3.5 flex flex-col items-center px-6 py-12 text-center`}>
            <div className="grid h-[72px] w-[72px] place-items-center rounded-[22px] bg-[#f7e3e7]">
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
        ) : (
          <div className="mt-3.5 flex flex-col gap-3.5">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>

      {/* ===== BOTTOM NAV (Records active) ===== */}
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-line-rose bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map(({ label, Icon }, i) => {
            const active = i === 3;
            return (
              <button
                key={label}
                type="button"
                className="flex cursor-pointer flex-col items-center gap-1 py-2.5"
                onClick={() => {
                  if (active) return;
                  if (i === 0) router.push("/home");
                  else if (i === 1) router.push("/recharge");
                  else if (i === 2) router.push("/invite");
                  else if (i === 4) router.push("/profile");
                  else showAlert(label + " coming soon");
                }}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 2.4 : 2}
                  className={active ? "text-maroon-700" : "text-[#b9a5aa]"}
                />
                <span
                  className={`text-[10px] font-semibold ${
                    active ? "text-maroon-700" : "text-[#b9a5aa]"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

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
  Copy,
  ChevronRight,
  Landmark,
  ArrowLeftRight,
  Gift,
  Headphones,
  Download,
  Smartphone,
} from "lucide-react";
import logo from "../../public/aramco-logo.png";
import BottomNav from "../components/BottomNav";
import { readCache, clearUserSession } from "../components/liveCache";

/* menu — Plan Record / Bank Settings / Txn History / Team / Invite / Support / Download / Logout */
const MENU_ITEMS = [
  { label: "Plan Record", Icon: ReceiptText, tile: "bg-[var(--c-tint2)] text-maroon-600", to: "/records" },
  { label: "Bank Settings", Icon: Landmark, tile: "bg-[#fdf6e4] text-[#a9791c]", to: "/card" },
  { label: "Transaction History", Icon: ArrowLeftRight, tile: "bg-[#eef4ff] text-[#2563eb]", to: "/transaction" },
  { label: "My Team", Icon: Users, tile: "bg-[#eafaf0] text-[#16a34a]", to: "/team" },
  { label: "Invite Friends", Icon: Gift, tile: "bg-[#f3e8ff] text-[#7c3aed]", to: "/invite" },
  { label: "Support", Icon: Headphones, tile: "bg-[#e0f7fa] text-[#00838f]", to: null },
  { label: "Download App", Icon: Download, tile: "bg-[#e8eaf6] text-[#3949ab]", to: null },
];

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* type-wise amount sum from localStorage zapto_transactions */
const sumByType = (type) => {
  try {
    return (JSON.parse(localStorage.getItem("zapto_transactions") || "[]"))
      .filter((t) => t.type === type)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  } catch {
    return 0;
  }
};

/* ================= SMALL PARTS ================= */

/* Centered alert — same as the other pages (2s auto-hide) */
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

/* menu row — icon tile + label + chevron */
function MenuRow({ Icon, tile, label, onClick, last }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3.5 px-2 py-3.5 text-left transition-colors duration-150 hover:bg-[var(--c-tint)] max-[360px]:py-3 ${
        last ? "" : "border-b border-line-rose/70"
      }`}
    >
      <span className={`grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px] ${tile}`}>
        <Icon size={19} strokeWidth={2.1} />
      </span>
      <span className="flex-1 text-[14.5px] font-bold text-ink">{label}</span>
      <ChevronRight size={17} className="shrink-0 text-[#c4adb3]" />
    </button>
  );
}

/* ================= MAIN PAGE ================= */

export default function ProfilePage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Profile";
  }, []);
  const [phone, setPhone] = useState("");
  const [uid, setUid] = useState("");
  const [balance, setBalance] = useState(0);
  const [rechargeTotal, setRechargeTotal] = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef(null);

  /* realtime wallet — recharge approval / income lands here instantly */
  useEffect(() => {
    const h = (e) => {
      if (!e.detail) return;
      if (e.detail.balance !== undefined) setBalance(e.detail.balance || 0);
      if (e.detail.totalRecharge !== undefined)
        setRechargeTotal(e.detail.totalRecharge || 0);
      if (e.detail.totalIncome !== undefined)
        setIncomeTotal(e.detail.totalIncome || 0);
    };
    window.addEventListener("zapto:wallet", h);
    return () => window.removeEventListener("zapto:wallet", h);
  }, []);

  /* token guard + user data load (wallet API — real balance after admin approval) */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setPhone(localStorage.getItem("zapto_phone") || "");

    /* wallet — balance/recharge/income + userid from the server (localStorage fallback on failure) */
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && d.wallet) {
          setRechargeTotal(d.wallet.totalRecharge || 0);
          setIncomeTotal(d.wallet.totalIncome || 0);
          setBalance(d.wallet.balance || 0);
          if (d.wallet.userid) {
            setUid(d.wallet.userid);
            localStorage.setItem("zapto_uid", d.wallet.userid);
          }
          return;
        }
      } catch (e) {}
      /* fallback */
      setRechargeTotal(sumByType("recharge"));
      setIncomeTotal(sumByType("income"));
    })();

    /* unique user ID — use the localStorage one if the server doesn't provide it */
    let id = localStorage.getItem("zapto_uid");
    if (!id) {
      id = "ZP" + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem("zapto_uid", id);
    }
    setUid(id);
  }, [router]);

  /* INSTANT + LIVE — balance shows from cache instantly (no ₹0 flash), plus
     live updates on zapto:wallet (GlobalAuthGuard caches + fans out every
     wallet response — recharge/income approvals show up immediately) */
  useEffect(() => {
    const apply = (w) => {
      setRechargeTotal(w.totalRecharge || 0);
      setIncomeTotal(w.totalIncome || 0);
      setBalance(w.balance || 0);
      if (w.userid) {
        setUid(w.userid);
        localStorage.setItem("zapto_uid", w.userid);
      }
    };
    const c = readCache("wallet");
    if (c) apply(c);
    const h = (e) => {
      if (e.detail) apply(e.detail);
    };
    window.addEventListener("zapto:wallet", h);
    return () => window.removeEventListener("zapto:wallet", h);
  }, []);

  const showAlert = (msg) => {
    clearTimeout(alertTimer.current);
    setAlertMsg("");
    requestAnimationFrame(() => {
      setAlertMsg(msg);
      alertTimer.current = setTimeout(() => setAlertMsg(""), 2000);
    });
  };

  /* Clipboard + execCommand fallback — same as the invite page */
  const copyText = async (text, msg) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showAlert(msg);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showAlert(msg);
      } catch {
        showAlert("Failed to copy");
      }
    }
  };

  const logout = () => {
    /* full session wipe — the next account on this device must not see this
       user's balance, transactions, orders, invite code or bank card */
    clearUserSession();
    router.replace("/login");
  };

  const onMenuClick = (item) => {
    if (item.to) router.push(item.to);
    else showAlert(item.label + " coming soon");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell) ===== */}
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
        {/* --- PROFILE HERO (maroon gradient — like the team hero) --- */}
        <section className="rounded-[22px] bg-[linear-gradient(135deg,var(--c-deep)_0%,var(--c-primary)_45%,var(--c-primary2)_100%)] p-5 shadow-[0_12px_34px_var(--s-alert)]">
          <div className="absolute-pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-full border-2 border-gold/70 bg-[var(--c-tint)] max-[360px]:h-[54px] max-[360px]:w-[54px]">
              <Image src={logo} alt="Profile avatar" fill sizes="62px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[19px] font-bold leading-tight text-white max-[360px]:text-[17px]">
                {phone ? "+91 " + phone : "User"}
              </div>
              <div className="mt-1 text-[11px] font-medium text-white/70">
                Welcome back to SAUDI ARAMCO
              </div>
            </div>
          </div>

          {/* unique user id — copy chip */}
          <div className="mt-4 flex items-center justify-between gap-2 rounded-full bg-black/20 py-1.5 pl-4 pr-1.5">
            <span className="truncate text-[12.5px] font-semibold tracking-[0.5px] text-white/85">
              User ID: <span className="font-bold text-gold">{uid || "…"}</span>
            </span>
            <button
              type="button"
              aria-label="Copy User ID"
              onClick={() => copyText(uid, "User ID copied!")}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/20"
            >
              <Copy size={12} strokeWidth={2.4} />
              Copy
            </button>
          </div>

          {/* stats — Balance / Total Recharge / Total Income */}
          <div className="mt-3.5 grid grid-cols-3 gap-2 max-[360px]:gap-1.5">
            {[
              { lbl: "Balance", val: fmt(balance) },
              { lbl: "Total Recharge", val: fmt(rechargeTotal) },
              { lbl: "Total Income", val: fmt(incomeTotal) },
            ].map(({ lbl, val }) => (
              <div
                key={lbl}
                className="rounded-[14px] bg-white/12 px-1.5 py-2.5 text-center backdrop-blur-sm max-[360px]:py-2"
              >
                <div className="text-[8.5px] font-semibold uppercase tracking-[0.4px] text-white/75 max-[360px]:text-[8px]">
                  {lbl}
                </div>
                <div className="mt-1 truncate text-[12.5px] font-bold leading-none text-white max-[360px]:text-[11px]">
                  {val}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* --- MENU --- */}
        <div className="mt-3.5 rounded-[18px] border border-line-rose bg-white p-2 shadow-[0_4px_24px_rgba(87,18,36,0.07)]">
          {MENU_ITEMS.map((item, i) => (
            <MenuRow
              key={item.label}
              {...item}
              onClick={() => onMenuClick(item)}
              last={i === MENU_ITEMS.length - 1}
            />
          ))}
          <MenuRow
            Icon={LogOut}
            tile="bg-[#fdecec] text-[#dc2626]"
            label="Logout"
            onClick={logout}
            last
          />
        </div>

        {/* --- APP VERSION --- */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium text-muted-rose">
          <Smartphone size={12} />
          SAUDI ARAMCO v1.0.0
        </div>
      </div>

            <BottomNav active={4} />

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

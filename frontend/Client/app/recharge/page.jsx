"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  ReceiptText,
  Users,
  User,
  Wallet,
  LogOut,
  IndianRupee,
  Smartphone,
  Landmark,
  CreditCard,
  MessageCircle,
  CircleCheck,
  Copy,
  QrCode,
  X,
  Clock,
} from "lucide-react";
import logo from "../../public/zapto-logo.png";
import useLiveWallet from "../components/useLiveWallet";
import BottomNav from "../components/BottomNav";
import { useSettings } from "../components/SettingsProvider";

/* ================= DATA (live from admin recharge settings) ================= */

/* Method icon map — admin saves icon keys, client renders lucide icons */
const METHOD_ICONS = {
  smartphone: Smartphone,
  landmark: Landmark,
  wallet: Wallet,
  "credit-card": CreditCard,
  rupee: IndianRupee,
  message: MessageCircle,
};

/* Fallback when the settings API fails — mirrors admin defaults */
const DEFAULT_RECHARGE = {
  minAmount: 530,
  maxAmount: 50000,
  quickAmounts: [600, 2200],
  methods: [
    { name: "Pay-T", icon: "smartphone", active: true },
    { name: "Pay-D", icon: "landmark", active: true },
    { name: "Pay-M", icon: "wallet", active: true },
  ],
  manual: {
    enabled: true,
    title: "Manual Payment",
    upiId: "",
    accountName: "",
    qrImage: "",
    note: "",
  },
};

/* Merge admin recharge settings over the defaults (shared by the SSR
   seed and the live fetch — one source of truth for the shape) */
function mergeRecharge(source) {
  if (!source) return DEFAULT_RECHARGE;
  const rc = { ...DEFAULT_RECHARGE, ...source };
  rc.manual = { ...DEFAULT_RECHARGE.manual, ...(source.manual || {}) };
  rc.quickAmounts = Array.isArray(rc.quickAmounts) ? rc.quickAmounts : [];
  rc.methods = Array.isArray(rc.methods) ? rc.methods : [];
  return rc;
}

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,var(--c-primary)_0%,var(--c-primary2)_55%,var(--c-primary)_100%)] shadow-[0_10px_24px_var(--s-btn)]";

const card =
  "rounded-[18px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.07)]";

/* ================= SMALL PARTS ================= */

/* Centered alert — same pattern as other pages (2s auto-hide) */
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

/* Radio — reference style (filled dot selected state) */
function Radio({ selected }) {
  return (
    <span
      className={`grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 ${
        selected ? "border-maroon-600" : "border-[#dcc9ce]"
      }`}
    >
      {selected && <span className="h-[10px] w-[10px] rounded-full bg-maroon-600" />}
    </span>
  );
}

/* ================= MAIN PAGE ================= */

export default function RechargePage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Recharge";
  }, []);
  /* SSR-seeded admin settings — first paint already shows the real
     min/max amounts (no 1s default flash after refresh) */
  const gs = useSettings();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(
    () =>
      (((gs && gs.recharge ? mergeRecharge(gs.recharge).methods : []) || []).find((m) => m.active) || {})
        .name || ""
  );
  const [alertMsg, setAlertMsg] = useState("");
  const [wallet, setWallet] = useState({ rechargeBalance: 0 });
  useLiveWallet(setWallet); /* realtime — recharge approval lands here instantly */
  const [cfg, setCfg] = useState(() => mergeRecharge(gs && gs.recharge));
  const [manualOpen, setManualOpen] = useState(false);
  const alertTimer = useRef(null);

  /* token guard — /recharge stays locked without login */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    /* wallet balance + recharge settings (admin panel live) */
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && d.wallet) setWallet(d.wallet);
      } catch (e) {}
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (d.success && d.settings && d.settings.recharge) {
          const rc = mergeRecharge(d.settings.recharge);
          setCfg(rc);
          /* preselect first active method */
          const first = rc.methods.find((m) => m.active);
          if (first) setMethod(first.name);
        }
      } catch (e) {}
    })();
  }, [router]);

  /* scroll lock while the manual payment sheet is open */
  useEffect(() => {
    document.body.style.overflow = manualOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [manualOpen]);

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

  /* digits only */
  const onAmountChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 7);
    setAmount(v);
  };

  const minA = Number(cfg.minAmount) || 0;
  const maxA = Number(cfg.maxAmount) || 0;
  const activeMethods = cfg.methods.filter((m) => m.active);
  const selectedMethod = activeMethods.find((m) => m.name === method);

  /* deposit request — appears as Pending in the admin panel, credited on approval */
  const submitDeposit = async () => {
    const token = localStorage.getItem("zapto_token");
    const methodLabel = method || "Pay-T";
    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ amount: Number(amount), method: methodLabel }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showAlert(data.message || "Recharge request failed");
        return false;
      }
    } catch (e) {
      showAlert("Network error — please try again");
      return false;
    }
    /* recharge txn record — shows up in transaction history */
    try {
      const txns = JSON.parse(localStorage.getItem("zapto_transactions") || "[]");
      txns.unshift({
        id: "RC" + String(Date.now()).slice(-8),
        type: "recharge",
        amount: Number(amount),
        method: methodLabel.toUpperCase(),
        at: new Date().toISOString(),
        status: "Pending",
      });
      localStorage.setItem("zapto_transactions", JSON.stringify(txns));
    } catch (e) {}
    showAlert("Recharge request submitted!");
    setAmount("");
    return true;
  };

  /* Pay — validate, then open the manual payment sheet (admin controlled) */
  const pay = () => {
    if (!amount || Number(amount) <= 0) {
      showAlert("Enter the recharge amount");
      return;
    }
    if (minA && Number(amount) < minA) {
      showAlert("Minimum recharge is ₹" + minA);
      return;
    }
    if (maxA && Number(amount) > maxA) {
      showAlert("Maximum recharge is ₹" + maxA);
      return;
    }
    if (!method) {
      showAlert("Select a payment method");
      return;
    }
    if (cfg.manual.enabled) {
      setManualOpen(true);
      return;
    }
    submitDeposit();
  };

  /* copy UPI ID to clipboard */
  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(cfg.manual.upiId);
      showAlert("UPI ID copied!");
    } catch (e) {
      showAlert(cfg.manual.upiId);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell — same as home/invite) ===== */}
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
      </header>

      {/* ===== CONTENT ===== */}
      <div className="flex-1 bg-[var(--c-bg)] px-3.5 pb-28 pt-3.5">
        {/* --- TITLE (same row style as the withdrawal page) --- */}
        <div className="flex items-center justify-between">
          <div className="font-display text-[20px] font-bold text-ink">Recharge</div>
          <span className="rounded-full bg-[var(--c-tint2)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-maroon-700">
            Min ₹{(Number(cfg.minAmount) || 0).toLocaleString("en-IN")}
          </span>
        </div>

        {/* --- AMOUNT (same card layout as the withdrawal page) --- */}
        <div className={`${card} mt-3 p-4`}>
          <label className="mb-1.5 block text-[12.5px] font-bold text-ink">Amount</label>
          <div className="flex items-center gap-2.5 rounded-xl bg-[var(--c-tint)] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
            <IndianRupee size={17} strokeWidth={2.4} className="shrink-0 text-icon-rose" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:text-[13.5px] placeholder:font-medium placeholder:text-[#bd9fa6]"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={onAmountChange}
              placeholder="Enter Amount"
              aria-label="Recharge amount"
            />
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-[#7d6a6e]">
            Recharge Balance :
            <span className="font-bold text-ink">{fmt(wallet.rechargeBalance)}</span>
          </div>

          {/* quick amounts — chips inside the amount card */}
          {cfg.quickAmounts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cfg.quickAmounts.map((amt) => {
                const active = amount === String(amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(String(amt))}
                    className={`cursor-pointer rounded-full border px-4 py-1.5 text-[13px] font-bold transition-all duration-150 active:scale-[0.95] ${
                      active
                        ? "border-maroon-600/40 bg-[var(--c-tint)] text-maroon-700"
                        : "border-line-rose bg-white text-ink hover:bg-[var(--c-tint)]"
                    }`}
                  >
                    ₹{Number(amt).toLocaleString("en-IN")}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={pay}
            className={`mt-4 w-full cursor-pointer rounded-xl py-[14px] text-center font-display text-[16.5px] font-bold tracking-[0.4px] text-white transition-all duration-150 active:scale-[0.98] ${gradientBtn} max-[360px]:py-[13px]`}
          >
            Pay
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-rose">
            <Clock size={12} />
            {minA > 0 || maxA > 0
              ? `Min ₹${minA.toLocaleString("en-IN")}${
                  maxA > 0 ? ` • Max ₹${maxA.toLocaleString("en-IN")}` : ""
                }`
              : "Recharge requests are processed within 24 hours"}
          </div>
        </div>

        {/* --- PAYMENT METHOD (same card header style as Payout Method) --- */}
        <div className={`${card} mt-3 p-4`}>
          <div className="font-display text-[16px] font-bold text-ink">Payment Method</div>

          <div className="mt-2.5">
            {activeMethods.map((m) => {
              const Icon = METHOD_ICONS[m.icon] || Wallet;
              const selected = method === m.name;
              const tile =
                m.icon === "smartphone"
                  ? "bg-[var(--c-tint2)] text-maroon-600"
                  : m.icon === "landmark"
                    ? "bg-[#fdf6e4] text-[#a9791c]"
                    : m.icon === "rupee"
                      ? "bg-[#eef4ff] text-[#2563eb]"
                      : m.icon === "message"
                        ? "bg-[#eef4ff] text-[#2563eb]"
                        : m.icon === "credit-card"
                          ? "bg-[var(--c-tint2)] text-maroon-600"
                          : "bg-[#eafaf0] text-[#16a34a]";
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setMethod(m.name)}
                  aria-pressed={selected}
                  className={`mb-1.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 active:scale-[0.99] ${
                    selected
                      ? "border-maroon-600/35 bg-[var(--c-tint)]"
                      : "border-line-rose/70 bg-white hover:bg-[var(--c-tint)]"
                  } last:mb-0`}
                >
                  <span
                    className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl ${tile}`}
                  >
                    <Icon size={19} strokeWidth={2.1} />
                  </span>
                  <span className="flex-1 text-[14.5px] font-bold text-ink">{m.name}</span>
                  <Radio selected={selected} />
                </button>
              );
            })}
            {activeMethods.length === 0 && (
              <div className="rounded-xl border border-dashed border-line-rose py-6 text-center text-[13px] font-semibold text-muted-rose">
                No payment methods available right now
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== MANUAL PAYMENT SHEET (admin controlled) ===== */}
      {manualOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
          onClick={() => setManualOpen(false)}
        >
          <div
            className="w-full max-w-[430px] animate-[slide-up_0.25s_ease] rounded-t-[24px] border-t border-line-rose bg-white px-5 pb-24 pt-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-rose" />
            <div className="flex items-center justify-between">
              <div className="font-display text-[20px] font-bold text-ink">
                {cfg.manual.title || "Manual Payment"}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setManualOpen(false)}
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] bg-[var(--c-tint)] text-[#a08a8f]"
              >
                <X size={16} />
              </button>
            </div>

            {/* amount summary */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-line-rose bg-[var(--c-tint)] px-4 py-3">
              <span className="text-[13px] font-semibold text-[#7d6a6e]">
                Pay via {method}
              </span>
              <span className="font-display text-[18px] font-bold text-maroon-700">
                {fmt(amount)}
              </span>
            </div>

            {/* QR image */}
            {cfg.manual.qrImage && (
              <div className="mt-4 flex flex-col items-center">
                <div className="relative h-[168px] w-[168px] overflow-hidden rounded-2xl border border-line-rose bg-white p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cfg.manual.qrImage}
                    alt="Payment QR code"
                    className="h-full w-full rounded-xl object-contain"
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted-rose">
                  <QrCode size={12} />
                  Scan to pay
                </div>
              </div>
            )}

            {/* UPI row */}
            {cfg.manual.upiId && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-line-rose bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-rose">
                    UPI ID
                  </div>
                  <div className="truncate text-[14.5px] font-bold text-ink">
                    {cfg.manual.upiId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyUpi}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--c-tint)] px-3.5 py-2 text-[12px] font-extrabold text-maroon-700 transition-all active:scale-95"
                >
                  <Copy size={13} />
                  Copy
                </button>
              </div>
            )}

            {/* account name */}
            {cfg.manual.accountName && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-line-rose bg-white px-4 py-3">
                <span className="text-[12.5px] font-semibold text-muted-rose">
                  Account Name
                </span>
                <span className="text-[13.5px] font-bold text-ink">
                  {cfg.manual.accountName}
                </span>
              </div>
            )}

            {/* note */}
            {cfg.manual.note && (
              <p className="mt-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
                {cfg.manual.note}
              </p>
            )}

            {/* actions */}
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="flex-1 cursor-pointer rounded-[14px] border border-line-rose bg-[var(--c-tint)] py-3.5 text-[15px] font-bold text-[#7d6a6e]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await submitDeposit();
                  if (ok) setManualOpen(false);
                }}
                className={`flex-[2] cursor-pointer rounded-[14px] py-3.5 text-[15px] font-extrabold text-white ${gradientBtn}`}
              >
                I Have Paid →
              </button>
            </div>
          </div>
        </div>
      )}

            <BottomNav active={1} />

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

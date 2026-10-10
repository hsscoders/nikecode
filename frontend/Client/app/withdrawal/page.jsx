"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
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
  LockKeyhole,
  Eye,
  EyeOff,
  CreditCard,
  Link2,
  Clock,
  Timer,
  Ban,
} from "lucide-react";
import logo from "../../public/aramco-logo.png";
import useLiveWallet from "../components/useLiveWallet";
import useLive from "../components/useLive";
import BottomNav from "../components/BottomNav";
import { useSettings } from "../components/SettingsProvider";

/* Fallback when the settings API fails — mirrors admin defaults */
const DEFAULT_WITHDRAW = {
  minAmount: 130,
  maxAmount: 50000,
  chargePercent: 10,
  dailyLimit: 0,
  startTime: "00:00",
  endTime: "23:59",
  enabled: true,
  note: "Withdrawals are processed within 24 hours",
};

/* current IST clock as "HH:MM" (24h) — matches the admin panel's IST window */
const istClock = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

/* today's IST date as "YYYY-MM-DD" */
const istToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,var(--c-primary)_0%,var(--c-primary2)_55%,var(--c-primary)_100%)] shadow-[0_10px_24px_var(--s-btn)]";

const card =
  "rounded-[18px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.07)]";

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

/* password field with an eye toggle — same as the login page */
function PasswordField({ value, onChange, show, onToggle }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[var(--c-tint)] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
      <LockKeyhole size={17} strokeWidth={2.3} className="shrink-0 text-icon-rose" />
      <input
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:text-[13.5px] placeholder:font-medium placeholder:text-[#bd9fa6]"
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder="Enter Withdrawal Password"
        aria-label="Withdrawal Password"
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={onToggle}
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center text-[#bd9fa6] transition-colors hover:text-maroon-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

export default function WithdrawalPage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Withdrawal";
  }, []);
  /* SSR-seeded admin settings — first paint already shows the real
     min/max limits (no 1s default flash after refresh) */
  const gs = useSettings();
  const [amount, setAmount] = useState("");
  const [wpass, setWpass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [bankCard, setBankCard] = useState(null);
  const [ready, setReady] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [wallet, setWallet] = useState({ balance: 0 });
  const [doneToday, setDoneToday] = useState(0); /* withdrawals already requested today */
  useLiveWallet(setWallet); /* realtime — withdrawal approval / refund lands here instantly */
  const [cfg, setCfg] = useState(() =>
    gs && gs.withdraw ? { ...DEFAULT_WITHDRAW, ...gs.withdraw } : DEFAULT_WITHDRAW
  );
  const alertTimer = useRef(null);

  /* token guard + bound card load + wallet balance */
  /* wallet + today-count refresh — initial load AND live pushes dono ke liye */
  const refreshData = useCallback(async () => {
    const token = localStorage.getItem("zapto_token");
    if (!token) return;
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && d.wallet) setWallet(d.wallet);
      } catch (e) {}
      /* withdrawal settings — admin panel live (limits + charge + switch + window) */
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (d.success && d.settings && d.settings.withdraw)
          setCfg({ ...DEFAULT_WITHDRAW, ...d.settings.withdraw });
      } catch (e) {}
      /* how many withdrawals has this user already requested today (IST)? */
      try {
        const r2 = await fetch("/api/transactions", {
          headers: { Authorization: "Bearer " + token },
        });
        const d2 = await r2.json();
        if (d2.success && Array.isArray(d2.txns)) {
          const today = istToday();
          const n = d2.txns.filter(
            (t) =>
              t.type === "withdraw" &&
              t.createdAt &&
              new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
                new Date(t.createdAt)
              ) === today
          ).length;
          setDoneToday(n);
        }
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    /* bank card guard — no bound card → straight to /card until the bank is added */
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("zapto_bank_card") || "null");
    } catch {
      saved = null;
    }
    setBankCard(saved);
    if (!saved || !saved.ifsc || !saved.account) {
      router.replace("/card");
      return;
    }
    refreshData();
    setReady(true);
  }, [router, refreshData]);

  /* LIVE — withdrawal approved/rejected/refunded → wallet + done-today update instantly */
  useLive("activity:update", (p) => {
    if (!p || p.type === "withdraw") refreshData();
  });
  /* LIVE — admin changed withdraw settings (switch/window/limits/charge) → re-read */
  useLive("settings:update", refreshData);

  const showAlert = (msg) => {
    clearTimeout(alertTimer.current);
    setAlertMsg("");
    requestAnimationFrame(() => {
      setAlertMsg(msg);
      alertTimer.current = setTimeout(() => setAlertMsg(""), 2000);
    });
  };

  /* withdrawal charge breakdown — admin-controlled %, live as the user types */
  const amtNum = Number(amount) || 0;
  const chgPct = Math.min(100, Math.max(0, Number(cfg.chargePercent) || 0));
  const chgAmt = Math.round(amtNum * chgPct) / 100;
  const netAmt = +(amtNum - chgAmt).toFixed(2);

  /* availability — master switch + IST window + daily limit (mirrors the server checks) */
  const wdEnabled = cfg.enabled !== false;
  const winStart = String(cfg.startTime || "00:00");
  const winEnd = String(cfg.endTime || "23:59");
  const nowIst = istClock();
  const inWindow =
    winStart === winEnd ||
    (winStart <= winEnd
      ? nowIst >= winStart && nowIst <= winEnd
      : nowIst >= winStart || nowIst <= winEnd);
  const dailyLimit = Math.min(99, Math.max(0, Number(cfg.dailyLimit) || 0));
  const limitOver = dailyLimit > 0 && doneToday >= dailyLimit;
  const wdBlocked = !wdEnabled || !inWindow || limitOver;
  const blockReason = !wdEnabled
    ? "Withdrawals are temporarily stopped by the admin"
    : !inWindow
    ? "Withdrawals are open between " + winStart + " and " + winEnd + " (IST) only"
    : "Daily withdrawal limit reached (" + dailyLimit + " per day)";

  const logout = () => {
    localStorage.removeItem("zapto_token");
    localStorage.removeItem("zapto_phone");
    router.replace("/login");
  };

  const withdraw = async () => {
    const minW = Number(cfg.minAmount) || 0;
    const maxW = Number(cfg.maxAmount) || 0;
    if (wdBlocked) return showAlert(blockReason);
    if (!bankCard) return showAlert("Bind your bank card first");
    if (!amount || Number(amount) <= 0) return showAlert("Enter the withdrawal amount");
    if (minW && Number(amount) < minW) return showAlert("Minimum withdrawal is ₹" + minW);
    if (maxW && Number(amount) > maxW) return showAlert("Maximum withdrawal is ₹" + maxW);
    if (!wpass) return showAlert("Enter the withdrawal password");
    /* withdraw request — server validates balance, appears as Pending in the admin panel */
    const token = localStorage.getItem("zapto_token");
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          amount: Number(amount),
          withdraw_password: wpass,
          bank: bankCard,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showAlert(data.message || "Withdrawal request failed");
        return;
      }
      if (data.wallet) setWallet((w) => ({ ...w, ...data.wallet }));
    } catch (e) {
      /* network fail — only a local txn record (offline demo) */
    }
    /* withdraw txn record — shows up in transaction history */
    try {
      const txns = JSON.parse(localStorage.getItem("zapto_transactions") || "[]");
      txns.unshift({
        id: "WD" + String(Date.now()).slice(-8),
        type: "withdraw",
        amount: Number(amount),
        at: new Date().toISOString(),
        status: "Pending",
      });
      localStorage.setItem("zapto_transactions", JSON.stringify(txns));
    } catch (e) {}
    showAlert("Withdrawal request submitted!");
    setAmount("");
    setWpass("");
    setDoneToday((n) => n + 1); /* daily-limit counter stays honest after the request */
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
        {/* --- TITLE --- */}
        <div className="flex items-center justify-between">
          <div className="font-display text-[20px] font-bold text-ink">Withdraw</div>
          <span className="rounded-full bg-[var(--c-tint2)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-maroon-700">
            Min ₹{(Number(cfg.minAmount) || 0).toLocaleString("en-IN")}
          </span>
        </div>

        {/* --- BLOCKED BANNER — switch off / out of window / daily limit --- */}
        {wdBlocked && (
          <div className="mt-3 flex items-center gap-2.5 rounded-[14px] border border-[#f3c4c4] bg-[#fdf1f1] px-3.5 py-3">
            <Ban size={16} strokeWidth={2.4} className="shrink-0 text-[#dc2626]" />
            <div className="text-[12.5px] font-bold leading-snug text-[#b91c1c]">
              {blockReason}
            </div>
          </div>
        )}

        {/* --- AMOUNT + PASSWORD --- */}
        <div className={`${card} mt-3 p-4`}>
          <label className="mb-1.5 block text-[12.5px] font-bold text-ink">Amount</label>
          <div className="flex items-center gap-2.5 rounded-xl bg-[var(--c-tint)] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
            <IndianRupee size={17} strokeWidth={2.4} className="shrink-0 text-icon-rose" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:text-[13.5px] placeholder:font-medium placeholder:text-[#bd9fa6]"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder="Enter Amount"
              aria-label="Withdrawal amount"
            />
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-[#7d6a6e]">
            Withdrawable Balance :
            <span className="font-bold text-ink">{fmt(wallet.balance)}</span>
          </div>

          {/* --- WITHDRAWAL CHARGE BREAKDOWN — admin-controlled % --- */}
          <div className="mt-2.5 rounded-[14px] border border-line-rose/80 bg-[var(--c-tint2)] px-3.5 py-3">
            {amtNum > 0 ? (
              <div className="flex flex-col gap-[7px]">
                <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted-rose">
                  <span>Withdraw Amount</span>
                  <span className="font-bold text-ink">{fmt(amtNum)}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted-rose">
                  <span>Charge ({chgPct}%)</span>
                  <span className="font-bold text-[#b3372f]">− {fmt(chgAmt)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-line-rose pt-[7px] text-[13px] font-extrabold text-ink">
                  <span>You&apos;ll Receive</span>
                  <span className="text-[15.5px] font-bold text-maroon-700">
                    {fmt(netAmt)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted-rose">
                <span>Withdrawal Charge</span>
                <span className="font-bold text-ink">{chgPct}%</span>
              </div>
            )}
          </div>

          {/* --- schedule info — window + daily limit (only when set) --- */}
          {!wdBlocked && (winStart !== "00:00" || winEnd !== "23:59" || dailyLimit > 0) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold text-muted-rose">
              {winStart !== winEnd && (
                <span className="flex items-center gap-1">
                  <Timer size={12} /> Open {winStart}–{winEnd} IST
                </span>
              )}
              {dailyLimit > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Max {dailyLimit}/day
                  {doneToday > 0 ? ` • ${doneToday} done` : ""}
                </span>
              )}
            </div>
          )}

          <div className="mt-3.5">
            <label className="mb-1.5 block text-[12.5px] font-bold text-ink">
              Withdrawal Password
            </label>
            <PasswordField
              value={wpass}
              onChange={(e) => setWpass(e.target.value.slice(0, 20))}
              show={showPass}
              onToggle={() => setShowPass((s) => !s)}
            />
          </div>

          <button
            type="button"
            onClick={withdraw}
            disabled={wdBlocked}
            className={`mt-4 w-full rounded-xl py-[14px] text-center font-display text-[16.5px] font-bold tracking-[0.4px] text-white transition-all duration-150 max-[360px]:py-[13px] ${
              wdBlocked
                ? "cursor-not-allowed bg-[#c9b8bd] shadow-none"
                : `cursor-pointer active:scale-[0.98] ${gradientBtn}`
            }`}
          >
            {wdBlocked ? "Withdrawals Stopped" : "Withdraw"}
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-rose">
            <Clock size={12} />
            {cfg.note || "Withdrawals are processed within 24 hours"}
          </div>
        </div>

        {/* --- PAYOUT METHOD (bound bank card) --- */}
        <div className={`${card} mt-3 p-4`}>
          <div className="flex items-center justify-between">
            <div className="font-display text-[16px] font-bold text-ink">Payout Method</div>
            {ready && bankCard && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#eafaf0] px-2.5 py-1 text-[10px] font-extrabold text-[#16a34a]">
                <span className="h-[6px] w-[6px] rounded-full bg-[#16a34a]" />
                Bound
              </span>
            )}
          </div>

          {!ready ? null : bankCard ? (
            <>
              <div className="mt-2.5">
                {[
                  { lbl: "Real Name", val: bankCard.realName },
                  { lbl: "IFSC", val: bankCard.ifsc },
                  { lbl: "Bank Name", val: bankCard.bankName },
                  { lbl: "Bank Account Number", val: bankCard.account },
                ].map(({ lbl, val }) => (
                  <div
                    key={lbl}
                    className="flex items-start justify-between gap-3 border-b border-line-rose/70 py-2.5 last:border-b-0"
                  >
                    <span className="shrink-0 text-[12.5px] font-semibold text-muted-rose">
                      {lbl}
                    </span>
                    <span className="break-all text-right text-[13.5px] font-bold text-ink">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => router.push("/card")}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-maroon-700/25 bg-white py-2.5 text-[13px] font-bold text-maroon-700 transition-all duration-150 active:scale-[0.98] hover:bg-[var(--c-tint)]"
              >
                <Link2 size={14} strokeWidth={2.3} />
                Update Bank Card
              </button>
            </>
          ) : (
            <div className="mt-3 flex flex-col items-center rounded-[14px] border border-dashed border-line-rose bg-[var(--c-tint)] px-4 py-7 text-center">
              <div className="grid h-[54px] w-[54px] place-items-center rounded-[16px] bg-[var(--c-tint2)]">
                <CreditCard size={26} strokeWidth={1.8} className="text-maroon-600" />
              </div>
              <div className="mt-3 text-[14px] font-bold text-ink">No bank card bound yet</div>
              <p className="mt-1 text-[12.5px] font-medium text-muted-rose">
                Bind your bank card to withdraw your earnings
              </p>
              <button
                type="button"
                onClick={() => router.push("/card")}
                className={`mt-4 flex cursor-pointer items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white transition-all duration-150 active:scale-[0.97] ${gradientBtn}`}
              >
                <Link2 size={14} strokeWidth={2.4} />
                Bind Bank Card
              </button>
            </div>
          )}
        </div>
      </div>

            <BottomNav active={-1} />

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

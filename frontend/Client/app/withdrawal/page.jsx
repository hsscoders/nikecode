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
  LockKeyhole,
  Eye,
  EyeOff,
  CreditCard,
  Link2,
  Clock,
} from "lucide-react";
import logo from "../../public/zapto-logo.png";

const NAV_ITEMS = [
  { label: "Home", Icon: Home },
  { label: "Recharge", Icon: IndianRupee },
  { label: "Invite", Icon: Users },
  { label: "Records", Icon: ReceiptText },
  { label: "Account", Icon: User },
];

/* Fallback when the settings API fails — mirrors admin defaults */
const DEFAULT_WITHDRAW = {
  minAmount: 130,
  maxAmount: 50000,
  note: "Withdrawals are processed within 24 hours",
};

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,#7c1d33_0%,#93293f_55%,#7c1d33_100%)] shadow-[0_10px_24px_rgba(124,29,51,0.35)]";

const card =
  "rounded-[18px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.07)]";

/* ================= SMALL PARTS ================= */

/* Centered alert — same as the other pages (2s auto-hide) */
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

/* password field with an eye toggle — same as the login page */
function PasswordField({ value, onChange, show, onToggle }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#fbf1f3] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
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
  const [amount, setAmount] = useState("");
  const [wpass, setWpass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [bankCard, setBankCard] = useState(null);
  const [ready, setReady] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [wallet, setWallet] = useState({ balance: 0 });
  const [cfg, setCfg] = useState(DEFAULT_WITHDRAW);
  const alertTimer = useRef(null);

  /* token guard + bound card load + wallet balance */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      setBankCard(JSON.parse(localStorage.getItem("zapto_bank_card") || "null"));
    } catch {
      setBankCard(null);
    }
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && d.wallet) setWallet(d.wallet);
      } catch (e) {}
      /* withdrawal settings — admin panel live (limits + note) */
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (d.success && d.settings && d.settings.withdraw)
          setCfg({ ...DEFAULT_WITHDRAW, ...d.settings.withdraw });
      } catch (e) {}
    })();
    setReady(true);
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

  const withdraw = async () => {
    const minW = Number(cfg.minAmount) || 0;
    const maxW = Number(cfg.maxAmount) || 0;
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
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell) ===== */}
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
        {/* --- TITLE --- */}
        <div className="flex items-center justify-between">
          <div className="font-display text-[20px] font-bold text-ink">Withdraw</div>
          <span className="rounded-full bg-[#f7e3e7] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-maroon-700">
            Min ₹{(Number(cfg.minAmount) || 0).toLocaleString("en-IN")}
          </span>
        </div>

        {/* --- AMOUNT + PASSWORD --- */}
        <div className={`${card} mt-3 p-4`}>
          <label className="mb-1.5 block text-[12.5px] font-bold text-ink">Amount</label>
          <div className="flex items-center gap-2.5 rounded-xl bg-[#fbf1f3] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
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
            Balance :
            <span className="font-bold text-ink">{fmt(wallet.balance)}</span>
          </div>

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
            className={`mt-4 w-full cursor-pointer rounded-xl py-[14px] text-center font-display text-[16.5px] font-bold tracking-[0.4px] text-white transition-all duration-150 active:scale-[0.98] ${gradientBtn} max-[360px]:py-[13px]`}
          >
            Withdraw
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
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-maroon-700/25 bg-white py-2.5 text-[13px] font-bold text-maroon-700 transition-all duration-150 active:scale-[0.98] hover:bg-[#fbf1f3]"
              >
                <Link2 size={14} strokeWidth={2.3} />
                Update Bank Card
              </button>
            </>
          ) : (
            <div className="mt-3 flex flex-col items-center rounded-[14px] border border-dashed border-line-rose bg-[#fdf7f8] px-4 py-7 text-center">
              <div className="grid h-[54px] w-[54px] place-items-center rounded-[16px] bg-[#f7e3e7]">
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

      {/* ===== BOTTOM NAV (nothing active) ===== */}
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-line-rose bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map(({ label, Icon }, i) => (
            <button
              key={label}
              type="button"
              className="flex cursor-pointer flex-col items-center gap-1 py-2.5"
              onClick={() => {
                if (i === 0) router.push("/home");
                else if (i === 1) router.push("/recharge");
                else if (i === 2) router.push("/invite");
                else if (i === 3) router.push("/records");
                else if (i === 4) router.push("/profile");
                else showAlert(label + " coming soon");
              }}
            >
              <Icon size={21} strokeWidth={2} className="text-[#b9a5aa]" />
              <span className="text-[10px] font-semibold text-[#b9a5aa]">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ===== CENTERED ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

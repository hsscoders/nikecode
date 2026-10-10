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
  CircleCheck,
} from "lucide-react";
import logo from "../../public/zapto-logo.png";

/* ================= DATA ================= */

const QUICK_AMOUNTS = [600, 2200];

const PAY_METHODS = [
  { id: "pay-t", name: "Pay-T", Icon: Smartphone, tile: "bg-[#f7e3e7] text-maroon-600" },
  { id: "pay-d", name: "Pay-D", Icon: Landmark, tile: "bg-[#fdf6e4] text-[#a9791c]" },
  { id: "pay-m", name: "Pay-M", Icon: Wallet, tile: "bg-[#eafaf0] text-[#16a34a]" },
];

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

/* ================= SMALL PARTS ================= */

/* Centered alert — invite jaisa (2s auto-hide) */
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

/* Radio — reference jaisa (filled dot selected state) */
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
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pay-t");
  const [alertMsg, setAlertMsg] = useState("");
  const [wallet, setWallet] = useState({ rechargeBalance: 0 });
  const alertTimer = useRef(null);

  /* token guard — bina login /recharge khali nahi khulega */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    /* wallet — recharge balance live (admin approve hone par badhega) */
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && d.wallet) setWallet(d.wallet);
      } catch (e) {}
    })();
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

  /* sirf digits allow */
  const onAmountChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 7);
    setAmount(v);
  };

  const pay = async () => {
    if (!amount || Number(amount) <= 0) {
      showAlert("Enter the recharge amount");
      return;
    }
    const token = localStorage.getItem("zapto_token");
    const methodLabel = { "pay-t": "Pay-T", "pay-d": "Pay-D", "pay-m": "Pay-M" }[method] || method.toUpperCase();
    /* deposit request — admin panel me Pending me dikhegi, approve par recharge balance credit */
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
        return;
      }
    } catch (e) {
      /* network fail — sirf local txn record (offline demo) */
    }
    /* recharge txn record — transaction history me dikhega */
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
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell — home/invite jaisa) ===== */}
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
        {/* --- QUICK AMOUNTS --- */}
        <div className={`${card} p-3`}>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_AMOUNTS.map((amt) => {
              const active = amount === String(amt);
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className={`cursor-pointer rounded-xl border py-3 text-center text-[15px] font-bold transition-all duration-150 active:scale-[0.97] ${
                    active
                      ? "border-maroon-600/40 bg-[#fbf1f3] text-maroon-700"
                      : "border-transparent bg-[#f6f0f1] text-ink hover:bg-[#fbf1f3]"
                  }`}
                >
                  {amt}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- BALANCE + AMOUNT INPUT --- */}
        <div className={`${card} mt-3 p-4`}>
          <div className="text-[13.5px] text-[#7d6a6e]">
            Balance :{" "}
            <span className="font-bold text-ink">{fmt(wallet.rechargeBalance)}</span>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#fbf1f3] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
            <IndianRupee size={18} strokeWidth={2.4} className="shrink-0 text-icon-rose" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold text-ink outline-none placeholder:text-[14.5px] placeholder:font-medium placeholder:text-[#bd9fa6]"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={onAmountChange}
              placeholder="Enter the recharge amount"
              aria-label="Recharge amount"
            />
          </div>
        </div>

        {/* --- SELECT PAYMENT METHOD --- */}
        <div className={`${card} mt-3 px-3 pb-3 pt-4`}>
          <div className="mb-2.5 text-center text-[15px] font-extrabold text-ink">
            Select Payment Method
          </div>
          {PAY_METHODS.map(({ id, name, Icon, tile }) => {
            const selected = method === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                aria-pressed={selected}
                className={`mb-1.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 active:scale-[0.99] ${
                  selected
                    ? "border-maroon-600/35 bg-[#fbf1f3]"
                    : "border-line-rose/70 bg-white hover:bg-[#fdf7f8]"
                } last:mb-0`}
              >
                <span
                  className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl ${tile}`}
                >
                  <Icon size={19} strokeWidth={2.1} />
                </span>
                <span className="flex-1 text-[14.5px] font-bold text-ink">{name}</span>
                <Radio selected={selected} />
              </button>
            );
          })}
        </div>

        {/* --- PAY BUTTON --- */}
        <button
          type="button"
          onClick={pay}
          className={`mt-4 w-full cursor-pointer rounded-xl py-[15px] text-center font-display text-[17px] font-bold tracking-[0.4px] text-white transition-all duration-150 active:scale-[0.98] ${gradientBtn} max-[360px]:py-[13px]`}
        >
          Pay
        </button>
      </div>

      {/* ===== BOTTOM NAV (Recharge active) ===== */}
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-line-rose bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map(({ label, Icon }, i) => {
            const active = i === 1;
            return (
              <button
                key={label}
                type="button"
                className="flex cursor-pointer flex-col items-center gap-1 py-2.5"
                onClick={() => {
                  if (active) return;
                  if (i === 0) router.push("/home");
                  else if (i === 2) router.push("/invite");
                  else if (i === 3) router.push("/records");
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

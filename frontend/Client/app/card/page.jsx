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
  Landmark,
  Hash,
  Building2,
  Wifi,
} from "lucide-react";
import logo from "../../public/zapto-logo.png";

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

/* field sanitizers */
const cleanName = (v) => v.replace(/[^A-Za-z ]/g, "").slice(0, 30);
const cleanIfsc = (v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 11);
const cleanAccount = (v) => v.replace(/\D/g, "").slice(0, 18);
const cleanBank = (v) => v.replace(/[^A-Za-z0-9 .&'-]/g, "").slice(0, 30);
const groupAccount = (v) => v.replace(/(.{4})/g, "$1 ").trim();

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

/* labeled field — like the screenshot (label on top, rose input box) */
function Field({ label, Icon, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-bold text-ink">
        {label} <span className="text-maroon-600">*</span>
      </label>
      <div className="flex items-center gap-2.5 rounded-xl bg-[#fbf1f3] px-3.5 py-3 transition-all duration-150 focus-within:ring-[3px] focus-within:ring-maroon-600/15">
        <Icon size={17} strokeWidth={2.3} className="shrink-0 text-icon-rose" />
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:text-[13.5px] placeholder:font-medium placeholder:text-[#bd9fa6]";

/* ================= MAIN PAGE ================= */

export default function CardPage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Bank Card";
  }, []);
  const [realName, setRealName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [account, setAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef(null);

  /* token guard + already-bound card prefill (edit mode) */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("zapto_bank_card") || "null");
      if (saved) {
        setRealName(saved.realName || "");
        setIfsc(saved.ifsc || "");
        setAccount(saved.account || "");
        setBankName(saved.bankName || "");
      }
    } catch {}
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

  const confirm = () => {
    const name = realName.trim();
    if (!name) return showAlert("Enter your real name");
    if (name.length < 3) return showAlert("Name looks too short");
    if (!ifsc) return showAlert("Enter IFSC code");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return showAlert("Enter a valid IFSC code");
    if (!account) return showAlert("Enter bank account number");
    if (account.length < 9) return showAlert("Account number looks too short");
    if (!bankName.trim()) return showAlert("Enter bank name");

    localStorage.setItem(
      "zapto_bank_card",
      JSON.stringify({ realName: name, ifsc, account, bankName: bankName.trim() })
    );
    showAlert("Bank card bound successfully!");
    setTimeout(() => router.push("/withdrawal"), 900);
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
          <div className="font-display text-[20px] font-bold text-ink">Bind Bank Card</div>
          <span className="rounded-full bg-[#f7e3e7] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-maroon-700">
            Payout setup
          </span>
        </div>

        {/* --- LIVE CARD PREVIEW --- */}
        <div className="relative mx-auto mt-3.5 w-full max-w-[350px] overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#6b1830_0%,#7c1d33_45%,#93293f_100%)] p-5 shadow-[0_16px_40px_rgba(66,9,26,0.35)] max-[360px]:p-4">
          <div className="absolute -right-12 -top-16 h-[150px] w-[150px] rounded-full bg-white/[0.07]" />
          <div className="absolute -right-2 top-10 h-[84px] w-[84px] rounded-full bg-gold/15" />
          <div className="absolute -bottom-14 -left-10 h-[120px] w-[120px] rounded-full bg-black/10" />

          <div className="relative flex items-start justify-between">
            <div className="flex h-[38px] w-[48px] items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#e8c987,#d4a94f)] shadow-inner">
              <div className="h-[22px] w-[34px] rounded-[5px] border border-[#a97e2f]/60 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_8px,rgba(169,126,47,0.5)_8px,rgba(169,126,47,0.5)_9px)]" />
            </div>
            <Wifi size={19} strokeWidth={2.2} className="rotate-90 text-gold/85" />
          </div>

          <div className="relative mt-4 truncate text-[18px] font-bold tracking-[1.5px] text-white max-[360px]:text-[15px]">
            {groupAccount(account) || "•••• •••• •••• ••••"}
          </div>

          <div className="relative mt-3.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[8.5px] font-bold uppercase tracking-[1px] text-white/55">
                Card Holder
              </div>
              <div className="mt-0.5 truncate text-[13px] font-bold uppercase text-white">
                {realName.trim() || "YOUR NAME"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[8.5px] font-bold uppercase tracking-[1px] text-white/55">
                IFSC
              </div>
              <div className="mt-0.5 text-[13px] font-bold text-white">{ifsc || "———————0"}</div>
            </div>
          </div>

          <div className="relative mt-3 flex items-center justify-between border-t border-white/15 pt-3">
            <span className="truncate text-[11px] font-semibold text-white/75">
              {bankName.trim() || "Bank name"}
            </span>
            <span className="font-display text-[13px] font-bold tracking-[1.5px] text-gold">
              ZAPTO
            </span>
          </div>
        </div>

        {/* --- FORM --- */}
        <div className={`${card} mt-4 flex flex-col gap-3.5 p-4`}>
          <Field label="Real Name" Icon={User}>
            <input
              className={inputCls}
              type="text"
              value={realName}
              onChange={(e) => setRealName(cleanName(e.target.value))}
              placeholder="Enter Real Name"
              aria-label="Real Name"
            />
          </Field>
          <Field label="IFSC" Icon={Landmark}>
            <input
              className={`${inputCls} uppercase`}
              type="text"
              value={ifsc}
              onChange={(e) => setIfsc(cleanIfsc(e.target.value))}
              placeholder="Enter IFSC"
              aria-label="IFSC"
            />
          </Field>
          <Field label="Bank Account Number" Icon={Hash}>
            <input
              className={inputCls}
              type="text"
              inputMode="numeric"
              value={account}
              onChange={(e) => setAccount(cleanAccount(e.target.value))}
              placeholder="Enter Bank Account Number"
              aria-label="Bank Account Number"
            />
          </Field>
          <Field label="Bank Name" Icon={Building2}>
            <input
              className={inputCls}
              type="text"
              value={bankName}
              onChange={(e) => setBankName(cleanBank(e.target.value))}
              placeholder="Enter Bank Name"
              aria-label="Bank Name"
            />
          </Field>

          <button
            type="button"
            onClick={confirm}
            className={`mt-1 w-full cursor-pointer rounded-xl py-[14px] text-center font-display text-[16.5px] font-bold tracking-[0.4px] text-white transition-all duration-150 active:scale-[0.98] ${gradientBtn} max-[360px]:py-[13px]`}
          >
            Confirm
          </button>
        </div>

        <p className="mt-3 text-center text-[11.5px] font-medium leading-relaxed text-muted-rose">
          Make sure the account holder name matches your registered profile.
        </p>
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

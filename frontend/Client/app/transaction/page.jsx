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
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import logo from "../../public/aramco-logo.png";
import BottomNav from "../components/BottomNav";
import useLive from "../components/useLive";

const TABS = ["ALL", "Recharge", "Withdraw", "Earnings"];

/* ================= HELPERS ================= */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,var(--c-primary)_0%,var(--c-primary2)_55%,var(--c-primary)_100%)] shadow-[0_8px_20px_var(--s-btn)]";

const card =
  "rounded-[18px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.07)]";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/* ================= SMALL PARTS ================= */

/* txn row — recharge/income (green, down-left) / withdraw (red, up-right) /
   commission (gold, team) — style follows the record type */
function TxnRow({ txn }) {
  const kind =
    txn.type === "withdraw"
      ? "withdraw"
      : txn.type === "commission"
        ? "commission"
        : "credit"; /* recharge + income */
  const isDebit = kind === "withdraw";
  const isCommission = kind === "commission";
  const title =
    txn.title ||
    (txn.type === "recharge"
      ? "Recharge"
      : txn.type === "withdraw"
        ? "Withdraw"
        : txn.type === "commission"
          ? "Team Commission"
          : "Daily Income");
  return (
    <div
      className={`${card} flex items-center gap-3.5 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(87,18,36,0.12)] max-[360px]:p-3`}
    >
      <span
        className={`grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[14px] max-[360px]:h-[40px] max-[360px]:w-[40px] ${
          isDebit
            ? "bg-[#fdecec] text-[#dc2626]"
            : isCommission
              ? "bg-[#fdf6e4] text-[#a9791c]"
              : "bg-[#eafaf0] text-[#16a34a]"
        }`}
      >
        {isDebit ? (
          <ArrowUpRight size={20} strokeWidth={2.2} />
        ) : isCommission ? (
          <Users size={20} strokeWidth={2.2} />
        ) : (
          <ArrowDownLeft size={20} strokeWidth={2.2} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-bold text-ink">
            {title}
            {txn.method && !title.includes(txn.method) && (
              <span className="ml-1.5 text-[11px] font-semibold text-muted-rose">
                {txn.method}
              </span>
            )}
          </span>
          <span
            className={`shrink-0 text-[14.5px] font-extrabold max-[360px]:text-[13.5px] ${
              isDebit ? "text-[#dc2626]" : isCommission ? "text-[#a9791c]" : "text-[#16a34a]"
            }`}
          >
            {isDebit ? "-" : "+"}
            {fmt(txn.amount)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-muted-rose">
            <Clock3 size={11} />
            {fmtDate(txn.at)} · {fmtTime(txn.at)}
          </span>
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.4px] ${
              txn.status === "Success"
                ? "bg-[#eafaf0] text-[#16a34a]"
                : txn.status === "Rejected"
                  ? "bg-[#fdecec] text-[#dc2626]"
                  : "bg-[#fdf6e4] text-[#a9791c]"
            }`}
          >
            <span
              className={`h-[5px] w-[5px] rounded-full ${
                txn.status === "Success"
                  ? "bg-[#16a34a]"
                  : txn.status === "Rejected"
                    ? "bg-[#dc2626]"
                    : "bg-[var(--c-accent)]"
              }`}
            />
            {txn.status}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

export default function TransactionPage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Transaction History";
  }, []);
  const [tab, setTab] = useState(0); // 0=ALL, 1=Recharge, 2=Withdraw, 3=Earnings
  const [txns, setTxns] = useState([]);
  const [ready, setReady] = useState(false);

  /* token guard + transactions from the server ledger (localStorage fallback) */
  const loadTxns = useCallback(async () => {
    const token = localStorage.getItem("zapto_token");
    if (!token) return;
    try {
      const r = await fetch("/api/transactions", {
        headers: { Authorization: "Bearer " + token },
      });
      const d = await r.json();
      if (d.success && Array.isArray(d.txns)) {
        setTxns(
          d.txns.map((t) => ({
            id: t._id,
            type: t.type,
            title: t.title,
            method: t.method || "",
            amount: t.amount,
            status: t.status,
            at: t.createdAt,
          }))
        );
        setReady(true);
        return;
      }
    } catch (e) {}
    /* fallback — offline/local records */
    try {
      setTxns(JSON.parse(localStorage.getItem("zapto_transactions") || "[]"));
    } catch {
      setTxns([]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    loadTxns();
  }, [router, loadTxns]);

  /* LIVE — recharge/withdraw approved or new request → list refreshes itself */
  useLive("activity:update", loadTxns);

  const filtered = txns.filter((t) => {
    if (tab === 0) return true;
    if (tab === 1) return t.type === "recharge";
    if (tab === 2) return t.type === "withdraw";
    return t.type === "commission" || t.type === "income";
  });

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
          <div className="font-display text-[20px] font-bold text-ink">Transaction History</div>
          {ready && txns.length > 0 && (
            <span className="rounded-full bg-[var(--c-tint2)] px-3 py-1 text-[11px] font-bold text-maroon-700">
              {txns.length} {txns.length === 1 ? "record" : "records"}
            </span>
          )}
        </div>

        {/* --- TABS (skewed active pill — reference style) --- */}
        <div className={`${card} mt-3 flex p-1`}>
          {TABS.map((label, i) => {
            const active = tab === i;
            return (
              <button key={label} type="button" onClick={() => setTab(i)} className="flex-1 cursor-pointer">
                <span
                  className={`block -skew-x-12 px-2 py-2.5 text-[13px] font-extrabold tracking-[0.3px] transition-all duration-200 ${
                    active ? `${gradientBtn} text-white` : "text-[#7d6a6e] hover:text-maroon-600"
                  }`}
                >
                  <span className="block skew-x-12">{label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* --- LIST / EMPTY STATE --- */}
        {!ready ? null : filtered.length === 0 ? (
          <div className={`${card} mt-3.5 flex flex-col items-center px-6 py-14 text-center`}>
            <div className="grid h-[72px] w-[72px] place-items-center rounded-[22px] bg-[var(--c-tint)]">
              <ReceiptText size={34} strokeWidth={1.6} className="text-[#c4adb3]" />
            </div>
            <div className="mt-4 font-display text-[22px] font-extrabold tracking-[1.5px] text-[#c4adb3]">
              NO DATA
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-rose">
              Recharge or withdraw to see
              <br />
              your transactions here
            </p>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-col gap-2.5">
            {filtered.map((t) => (
              <TxnRow key={t.id} txn={t} />
            ))}
          </div>
        )}
      </div>

            <BottomNav active={-1} />
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  CreditCard,
  ReceiptText,
  Users,
  User,
  Wallet,
  LogOut,
  Copy,
  CircleCheck,
} from "lucide-react";
import logo from "../../public/zapto-logo.png";
import BottomNav from "../components/BottomNav";

/* ================= HELPERS ================= */

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,var(--c-primary)_0%,var(--c-primary2)_55%,var(--c-primary)_100%)]";

const card =
  "rounded-[20px] border border-line-rose bg-white p-[18px] shadow-[0_4px_24px_rgba(87,18,36,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(87,18,36,0.12)]";

/* ================= SMALL PARTS ================= */

/* Centered alert like the reference — copy feedback (2s auto-hide) */
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

function CardTitle({ children }) {
  return (
    <div className="mb-[18px] flex flex-col items-center gap-2">
      <div className="font-display text-[17px] font-bold tracking-[0.2px] text-ink">
        {children}
      </div>
      <div className="h-[3px] w-[50px] rounded-full bg-[linear-gradient(90deg,var(--c-primary),var(--c-accent))]" />
    </div>
  );
}

/* Invite link / code field — tinted text + gradient copy button */
function CopyField({ value, msg, onCopy, big }) {
  return (
    <div className="mb-3.5 flex overflow-hidden rounded-xl border border-maroon-700/10 shadow-[0_2px_8px_rgba(87,18,36,0.04)] last:mb-0">
      <div
        className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap bg-[var(--c-tint)] px-3.5 py-3 leading-[1.5] text-[#7d6a6e] ${
          big ? "text-[15px] font-bold tracking-[0.5px] text-maroon-800" : "text-[13px]"
        }`}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onCopy(value, msg)}
        className={`flex min-w-[86px] shrink-0 cursor-pointer items-center justify-center gap-2 px-4 text-[14px] font-bold text-white transition-all duration-150 active:scale-[0.98] ${gradientBtn} max-[360px]:min-w-[70px] max-[360px]:px-3`}
      >
        <Copy size={14} strokeWidth={2.4} />
        Copy
      </button>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

export default function InvitePage() {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Invite";
  }, []);
  const [refId, setRefId] = useState("");
  const [link, setLink] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef(null);

  /* token guard — /invite stays locked without login */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    /* refId comes from /api/wallet — the invite link carries this code
       (not the phone, otherwise the backend referral match fails) */
    let cancel = false;
    (async () => {
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (cancel) return;
        if (r.ok && d.success && d.wallet && d.wallet.refId) {
          setRefId(d.wallet.refId);
          setLink(
            window.location.origin + "/register?inviteCode=" + d.wallet.refId
          );
        }
      } catch (e) {}
    })();
    return () => {
      cancel = true;
    };
  }, [router]);

  /* Centered alert — 2s auto-hide (reference timing) */
  const showAlert = (msg) => {
    clearTimeout(alertTimer.current);
    setAlertMsg("");
    requestAnimationFrame(() => {
      setAlertMsg(msg);
      alertTimer.current = setTimeout(() => setAlertMsg(""), 2000);
    });
  };

  /* Clipboard + execCommand fallback (reference style) */
  const copyText = async (text, msg) => {
    if (!text) {
      showAlert("Nothing to copy yet");
      return;
    }
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
    localStorage.removeItem("zapto_token");
    localStorage.removeItem("zapto_phone");
    router.replace("/login");
  };

  const qrSrc = link
    ? "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=" +
      encodeURIComponent(link)
    : "";

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER (app shell — same as home) ===== */}
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
      <div className="flex-1 px-3.5 pb-28 pt-3.5">
        {/* --- MY QR CODE --- */}
        <div className={card}>
          <CardTitle>My QR Code</CardTitle>
          <div className="relative mx-auto w-[200px] overflow-hidden rounded-[14px] border border-maroon-700/10 bg-white p-3.5 shadow-[0_5px_15px_rgba(87,18,36,0.08)]">
            <div className="absolute inset-x-0 top-0 h-[5px] bg-[linear-gradient(90deg,var(--c-primary),var(--c-primary2))]" />
            {qrSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrSrc}
                alt="Invitation QR Code"
                width={172}
                height={172}
                className="mt-[5px] h-[172px] w-[172px] object-contain"
              />
            ) : (
              <div className="mt-[5px] h-[172px] w-[172px] animate-pulse rounded-[8px] bg-[#f6e7ea]" />
            )}
          </div>
          <p className="mt-3 text-center text-[13px] font-medium text-muted-rose">
            Scan to join with my referral
          </p>
        </div>

        {/* --- MY REFERRAL DETAILS --- */}
        <div className={`${card} mt-4`}>
          <CardTitle>My Referral Details</CardTitle>
          <CopyField
            value={link || "Generating your invite link..."}
            msg="Invite link copied!"
            onCopy={copyText}
          />
          <CopyField
            value={refId || "Generating your invite code..."}
            msg="Referral code copied!"
            onCopy={copyText}
            big
          />
        </div>

        {/* --- COMMISSION LEVELS --- */}
        <div className={`${card} mt-4`}>
          <CardTitle>Commission Levels</CardTitle>
          {[
            { lvl: "Level 1 Commission", pct: "25%" },
            { lvl: "Level 2 Commission", pct: "3%" },
            { lvl: "Level 3 Commission", pct: "2%" },
          ].map(({ lvl, pct }) => (
            <div
              key={lvl}
              className="mb-2.5 flex items-center justify-between rounded-[10px] border border-line-rose/70 bg-[var(--c-tint)] px-3.5 py-3 text-[14px] last:mb-0 max-[360px]:px-3 max-[360px]:text-[13px]"
            >
              <span className="font-medium text-[#7d6a6e]">{lvl}</span>
              <span className="font-extrabold text-maroon-700">{pct}</span>
            </div>
          ))}

          {/* team link — below the commission levels */}
          <button
            type="button"
            onClick={() => router.push("/team")}
            className={`mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-maroon-700/25 bg-white py-3 text-[14px] font-bold text-maroon-700 transition-all duration-150 active:scale-[0.98] hover:bg-[var(--c-tint)]`}
          >
            <Users size={16} strokeWidth={2.2} />
            View My Team
          </button>
        </div>

        {/* --- INFO --- */}
        <div className={`${card} mt-4`}>
          <p className="text-center text-[13.5px] leading-relaxed text-[#7d6a6e]">
            Share your exclusive invitation link with friends and earn{" "}
            <span className="font-bold text-maroon-700">up to 30% commission</span>{" "}
            on their investments. The more you share, the more you earn!
          </p>
        </div>
      </div>

            <BottomNav active={2} />

      {/* ===== CENTERED COPY ALERT ===== */}
      <CenterAlert message={alertMsg} />
    </div>
  );
}

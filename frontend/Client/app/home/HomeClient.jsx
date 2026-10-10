"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  CreditCard,
  IndianRupee,
  ReceiptText,
  MessageCircle,
  Users,
  User,
  Wallet,
  TrendingUp,
  X,
  LogOut,
  Crown,
  Gift,
  Star,
  Zap,
  CircleCheck,
} from "lucide-react";
import planDaily from "../../public/product-starter.png";
import planVip from "../../public/product-platinum.png";
import logo from "../../public/aramco-logo.png";
import useLiveWallet from "../components/useLiveWallet";
import useLive from "../components/useLive";
import BottomNav from "../components/BottomNav";
import { useSettings } from "../components/SettingsProvider";
import { readCache, writeCache } from "../components/liveCache";

/* ================= DEMO FALLBACK (live plans/banners come from the admin panel) ================= */

const DAILY_PLANS = [
  { id: 1, name: "Starter Plan", img: planDaily, price: 530, daily: 63.6, cycle: 10, total: 636, used: 0, limit: 1, presale: false },
  { id: 2, name: "Silver Plan", img: planDaily, price: 1100, daily: 137.5, cycle: 12, total: 1650, used: 0, limit: 2, presale: false },
  { id: 3, name: "Gold Plan", img: planDaily, price: 2500, daily: 266.67, cycle: 15, total: 4000, used: 0, limit: 3, presale: false },
];

const VIP_PLANS = [
  { id: 11, name: "VIP Platinum", img: planVip, price: 5500, daily: 700, cycle: 12, total: 8400, used: 0, limit: 1, presale: false, vip: true },
  { id: 12, name: "VIP Diamond", img: planVip, price: 11000, daily: 1550, cycle: 15, total: 23250, used: 0, limit: 1, presale: true, vip: true },
];

const QUICK_ITEMS = [
  { label: "Recharge", Icon: CreditCard, tile: "bg-[var(--c-tint2)] text-maroon-600" },
  { label: "Withdraw", Icon: IndianRupee, tile: "bg-[#fdf6e4] text-[#a9791c]" },
  { label: "Records", Icon: ReceiptText, tile: "bg-[#eafaf0] text-[#16a34a]" },
  { label: "Channel", Icon: MessageCircle, tile: "bg-[#eef4ff] text-[#2563eb]" },
];

/* ================= WELCOME POPUP (controlled from the admin panel) ================= */

const POPUP_ICONS = {
  trending: TrendingUp,
  users: Users,
  rupee: IndianRupee,
  card: CreditCard,
  gift: Gift,
  star: Star,
  zap: Zap,
  check: CircleCheck,
};

/* Shown as the default when the API fails (the admin's saved config comes from /api/settings) */
const DEFAULT_POPUP = {
  enabled: true,
  title: "Welcome to SAUDI ARAMCO",
  subtitle: "Earn daily withdraw daily",
  buttonText: "Join Telegram Channel",
  buttonUrl: "",
  bullets: [
    { text: "Daily income & daily withdrawals", icon: "trending" },
    { text: "Team commission up to 30%", icon: "users" },
    { text: "Minimum withdrawal ₹130", icon: "rupee" },
    { text: "Minimum recharge ₹530", icon: "card" },
  ],
};

/* ================= HELPERS ================= */

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const gradientBtn =
  "bg-[linear-gradient(135deg,var(--c-primary)_0%,var(--c-primary2)_55%,var(--c-primary)_100%)] shadow-[0_10px_24px_var(--s-btn)]";

/* ================= SMALL PARTS ================= */

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed left-1/2 top-5 z-[70] -translate-x-1/2 whitespace-nowrap rounded-xl bg-maroon-900 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_var(--s-alert)]">
      {message}
    </div>
  );
}

function BannerCarousel({ banners }) {
  const [slide, setSlide] = useState(0);
  const [failed, setFailed] = useState(() => new Set());
  const ivRef = useRef(null);
  const touchX = useRef(0);

  /* failed slides drop out — only healthy admin banners ever render */
  const visible = banners.filter((_, i) => !failed.has(i));
  const count = visible.length;

  const startAuto = useCallback(() => {
    clearInterval(ivRef.current);
    if (count > 1) ivRef.current = setInterval(() => setSlide((s) => (s + 1) % count), 3200);
  }, [count]);

  useEffect(() => {
    startAuto();
    setSlide(0);
    return () => clearInterval(ivRef.current);
  }, [startAuto]);

  /* fresh banner list — clear old per-slide failures */
  useEffect(() => setFailed(new Set()), [banners]);

  const next = () => setSlide((s) => (s + 1) % count);
  const prev = () => setSlide((s) => (s - 1 + count) % count);

  if (!count) return null; /* nothing to show — no default artwork flash */

  return (
    <div
      className="relative mx-3.5 mt-3.5 h-[168px] overflow-hidden rounded-[18px] shadow-[0_6px_20px_rgba(87,18,36,0.14)] max-[360px]:h-[140px]"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        clearInterval(ivRef.current);
      }}
      onTouchEnd={(e) => {
        const dx = touchX.current - e.changedTouches[0].clientX;
        if (dx > 40) next();
        else if (dx < -40) prev();
        startAuto();
      }}
    >
      {visible.map((b, i) => (
        <Image
          key={b + "-" + i}
          src={b}
          alt={"Saudi Aramco banner " + (i + 1)}
          fill
          priority={i === 0}
          sizes="(max-width: 520px) 100vw, 430px"
          onError={() =>
            setFailed((prevSet) => {
              const idx = banners.indexOf(b);
              if (idx < 0 || prevSet.has(idx)) return prevSet;
              const n = new Set(prevSet);
              n.add(idx); /* broken slide removed — carousel stays clean */
              return n;
            })
          }
          className={`absolute inset-0 object-cover transition-opacity duration-500 ${
            i === slide ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-[5px]">
        {visible.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={"Go to slide " + (i + 1)}
            onClick={() => setSlide(i)}
            className={`h-[5px] cursor-pointer rounded-full transition-all duration-300 ${
              i === slide ? "w-[18px] bg-white" : "w-[5px] bg-white/45"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, type, onBuy }) {
  const isVip = type === "vip";
  return (
    <div className="group mx-3.5 mt-3.5 overflow-hidden rounded-[24px] border border-line-rose bg-white shadow-[0_4px_24px_rgba(87,18,36,0.08)]">
      {/* IMAGE */}
      <div className="relative h-[180px] overflow-hidden">
        <Image
          src={plan.img}
          alt={plan.name}
          fill
          sizes="(max-width: 520px) 100vw, 430px"
          className="absolute inset-0 object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--s-alert)_0%,var(--s-alert)_55%,transparent_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div className="font-display text-lg font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
            {plan.name}
          </div>
          {plan.limit > 0 && (
            <div className="rounded-full border border-white/35 bg-white/20 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur-sm">
              {plan.used}/{plan.limit}
            </div>
          )}
        </div>
      </div>

      {/* SPECS 2x2 */}
      <div className="grid grid-cols-2 border-b border-line-rose">
        {[
          { lbl: isVip ? "Value" : "Price", val: fmt(plan.price), cls: "text-maroon-700" },
          { lbl: isVip ? "Revenue/Day" : "Daily", val: fmt(plan.daily), cls: "text-[#16a34a]" },
          { lbl: "Cycle", val: plan.cycle + " Days", cls: "text-ink" },
          { lbl: isVip ? "Total Profit" : "Total Return", val: fmt(plan.total), cls: "text-[#a9791c]" },
        ].map((s) => (
          <div
            key={s.lbl}
            className="border-line-rose p-3.5 max-[360px]:p-3 [&:nth-child(n+3)]:border-t [&:nth-child(odd)]:border-r"
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-rose">
              {s.lbl}
            </div>
            <div className={`text-[15px] font-extrabold leading-none max-[360px]:text-sm ${s.cls}`}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* BUY */}
      <div className="p-4">
        {plan.presale ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl border border-dashed border-line-rose bg-[#fafafa] py-[14px] text-[14px] font-bold text-muted-rose"
          >
            Pre Sale
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBuy(plan)}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-[14px] text-[15px] font-extrabold text-white transition-all duration-150 active:scale-[0.97] ${gradientBtn}`}
          >
            {isVip && <Crown size={18} />}
            {isVip ? "Buy VIP Plan" : "Invest Now"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

/* ================= PLAN MAPPER (shared: SSR seed / cache / API fetch) ================= */

const mapPlan = (p) => ({
  ...p,
  /* admin-uploaded plan image — Saudi Aramco product art as fallback */
  img: p.image || (p.vip ? planVip : planDaily),
  used: 0,
});

export default function HomeClient({ initialBanners = null, initialPlans = null }) {
  const router = useRouter();

  /* page title */
  useEffect(() => {
    document.title = "Home";
  }, []);
  const [phone, setPhone] = useState("");
  const [tab, setTab] = useState(0); // 0 = Daily, 1 = VIP
  const [toast, setToast] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [notice, setNotice] = useState(false);
  /* INSTANT PAINT — SSR-seeded (ISR HTML me baked) banners/plans, warna
     localStorage cache, warna null (skeleton). Refresh par white banner ya
     "Buy Now → Pre Sale" ka 1-2s flash ABHOR NahI hota. */
  const [banners, setBanners] = useState(initialBanners);
  const [apiPlans, setApiPlans] = useState(() =>
    initialPlans && initialPlans.length ? initialPlans.map(mapPlan) : null
  );
  const [wallet, setWallet] = useState({ balance: 0, rechargeBalance: 0, totalIncome: 0 });
  useLiveWallet(setWallet); /* realtime — recharge approval / income / commission */
  /* SSR-seeded popup config — the notice renders with the real admin
     text on the very first paint (no 1s default/absent flash) */
  const gs = useSettings();
  const [popupCfg, setPopupCfg] = useState(() =>
    gs && gs.popup ? { ...DEFAULT_POPUP, ...gs.popup } : DEFAULT_POPUP
  );
  const [cfgReady, setCfgReady] = useState(() => !!(gs && gs.popup)); // SSR config already present
  const toastTimer = useRef(null);

  /* token guard — /home stays locked without login */
  useEffect(() => {
    const token = localStorage.getItem("zapto_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setPhone(localStorage.getItem("zapto_phone") || "");

    /* SSR/CACHE FAILSAFE — server render fail hua to localStorage cache
       se turant seed karo (repeat visit par kabhi khali skeleton nahi) */
    if (banners === null) {
      const cb = readCache("banners");
      if (cb) setBanners(cb);
    }
    if (apiPlans === null) {
      const cp = readCache("plans");
      if (cp && cp.length) setApiPlans(cp.map(mapPlan));
    }

    /* banners + plans + wallet + popup-settings — live from the admin panel (fallback on failure) */
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const d = await r.json();
        if (d.success && d.settings && d.settings.popup)
          setPopupCfg({ ...DEFAULT_POPUP, ...d.settings.popup });
      } catch (e) {}
      setCfgReady(true);
      fetchBanners();
      fetchPlans();
      try {
        const r = await fetch("/api/wallet", {
          headers: { Authorization: "Bearer " + token },
        });
        const d = await r.json();
        if (d.success && d.wallet) setWallet(d.wallet);
      } catch (e) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /* ---- live data loaders (also driven by socket events) ---- */
  const fetchBanners = useCallback(async () => {
    try {
      /* no-store — freshly added banners show up on the very next visit */
      const r = await fetch("/api/banners", { cache: "no-store" });
      const d = await r.json();
      if (d.success && d.banners) {
        const imgs = d.banners.map((b) => b.image);
        setBanners(imgs);
        writeCache("banners", imgs); /* next refresh: instant paint */
      }
    } catch (e) {}
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const r = await fetch("/api/plans");
      const d = await r.json();
      if (d.success && d.plans && d.plans.length) {
        setApiPlans(d.plans.map(mapPlan));
        writeCache("plans", d.plans); /* raw serializable plans cached */
      }
    } catch (e) {}
  }, []);

  /* LIVE — admin edits a plan or banner → home page updates instantly */
  useLive("plans:update", fetchPlans);
  useLive("banners:update", fetchBanners);

  /* if the popup config never arrives (network fail) — fall back after 2.5s */
  useEffect(() => {
    const t = setTimeout(() => setCfgReady(true), 2500);
    return () => clearTimeout(t);
  }, []);

  /* welcome notice after 800ms — only while the popup is enabled (admin can disable it) */
  useEffect(() => {
    if (!cfgReady || !popupCfg.enabled) return;
    const t = setTimeout(() => setNotice(true), 800);
    return () => clearTimeout(t);
  }, [cfgReady, popupCfg]);

  /* lock background scroll while a modal/notice is open */
  useEffect(() => {
    document.body.style.overflow = selectedPlan || notice ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPlan, notice]);

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const plans = tab === 0
    ? (apiPlans || DAILY_PLANS).filter((p) => !p.vip)
    : (apiPlans || VIP_PLANS).filter((p) => p.vip);

  /* plan buy power — recharge balance ONLY (income & wallet balance are withdrawable, not spendable) */
  const rechargeShort =
    !!selectedPlan && Number(wallet.rechargeBalance) < Number(selectedPlan.price);

  /* order save — localStorage (the records page reads from here) */
  const saveOrderLocal = (o) => {
    try {
      const orders = JSON.parse(localStorage.getItem("zapto_orders") || "[]");
      orders.unshift(o);
      localStorage.setItem("zapto_orders", JSON.stringify(orders));
    } catch (e) {}
  };

  /* Buy flow — server invest API (balance check + commission), local fallback on failure */
  const buyPlan = async (p) => {
    if (p._id) {
      try {
        const token = localStorage.getItem("zapto_token");
        const res = await fetch("/api/invest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ planId: p._id }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast(data.message || "Purchase failed");
          return;
        }
        saveOrderLocal(data.order);
        if (data.wallet) setWallet((w) => ({ ...w, ...data.wallet }));
        showToast("Plan purchased successfully!");
        setTimeout(() => router.push("/records"), 700);
        return;
      } catch (e) {
        showToast("Network error — please try again");
        return;
      }
    }
    /* fallback demo plan (API plans failed to load) */
    saveOrderLocal({
      id: "ZP" + String(Date.now()).slice(-8),
      name: p.name,
      vip: !!p.vip,
      price: p.price,
      daily: p.daily,
      cycle: p.cycle,
      total: p.total,
      boughtAt: new Date().toISOString(),
      status: "Active",
    });
    showToast("Plan purchased successfully!");
    setTimeout(() => router.push("/records"), 700);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col min-[520px]:mt-9 min-[520px]:min-h-0 min-[520px]:max-w-[430px] min-[520px]:overflow-hidden min-[520px]:rounded-[30px] min-[520px]:border min-[520px]:border-line-rose/90 min-[520px]:bg-white min-[520px]:shadow-[0_40px_90px_rgba(87,18,36,0.2),0_8px_24px_rgba(87,18,36,0.1)]">
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between bg-[linear-gradient(135deg,var(--c-deep)_0%,var(--c-primary)_55%,var(--c-primary2)_100%)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full ring-2 ring-gold/60 bg-white">
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

      {/* ===== BANNER CAROUSEL (admin banners only — skeleton while loading) ===== */}
      {banners === null ? (
        <div className="relative mx-3.5 mt-3.5 h-[168px] overflow-hidden rounded-[18px] bg-gradient-to-r from-[var(--c-tint2)] via-white to-[var(--c-tint2)] shadow-[0_6px_20px_rgba(87,18,36,0.14)] max-[360px]:h-[140px]">
          <div className="absolute inset-0 animate-[shimmer_1.6s_infinite] bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.75)_50%,transparent_80%)]" />
        </div>
      ) : (
        banners.length > 0 && <BannerCarousel banners={banners} />
      )}

      {/* ===== QUICK MENU ===== */}
      <div className="mx-3.5 mt-3.5 rounded-[20px] border border-maroon-900 bg-maroon-950 px-2.5 py-4 shadow-[0_8px_24px_var(--s-alert)]">
        <div className="grid grid-cols-4 gap-1">
          {QUICK_ITEMS.map(({ label, Icon, tile }) => (
            <button
              key={label}
              type="button"
              className="flex cursor-pointer flex-col items-center gap-2 py-1 transition-transform duration-150 active:scale-95"
              onClick={() => {
                if (label === "Recharge") router.push("/recharge");
                else if (label === "Withdraw") router.push("/withdrawal");
                else if (label === "Records") router.push("/records");
                else showToast(label + " coming soon");
              }}
            >
              <div className={`grid h-[52px] w-[52px] place-items-center rounded-2xl ${tile} max-[360px]:h-[46px] max-[360px]:w-[46px]`}>
                <Icon size={23} strokeWidth={2.1} />
              </div>
              <span className="text-[11px] font-semibold text-[#e9d4d9]">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="mx-3.5 mt-3.5 flex rounded-2xl border border-line-rose bg-white p-1 shadow-[0_2px_12px_rgba(87,18,36,0.06)]">
        {["Daily Plans", "Premium VIP"].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className={`flex-1 cursor-pointer rounded-[13px] py-2.5 font-display text-[14px] font-bold transition-all duration-200 ${
              tab === i
                ? `${gradientBtn} text-white`
                : "text-muted-rose hover:text-maroon-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===== PLANS ===== */}
      <div className="pb-28">
        {plans.map((plan) => (
          <PlanCard key={plan.id || plan._id} plan={plan} type={tab === 0 ? "daily" : "vip"} onBuy={setSelectedPlan} />
        ))}
      </div>

            <BottomNav active={0} />

      {/* ===== CONFIRM MODAL (bottom sheet) ===== */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="w-full max-w-[430px] animate-[slide-up_0.25s_ease] rounded-t-[24px] border-t border-line-rose bg-white px-5 pb-24 pt-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line-rose" />
            <div className="font-display text-[20px] font-bold text-ink">
              Confirm {selectedPlan.vip ? "VIP Purchase" : "Investment"}
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-rose">
              {selectedPlan.vip ? "Activating" : "Investing in"}{" "}
              <strong className="text-ink">{selectedPlan.name}</strong> for{" "}
              <strong className="text-maroon-700">{fmt(selectedPlan.price)}</strong>.
              <br />
              Daily income:{" "}
              <strong className="text-[#16a34a]">{fmt(selectedPlan.daily)}</strong>
            </p>

            {/* plan buy power — recharge balance ONLY (income & balance stay withdrawable) */}
            <div className="mt-3.5 flex items-center justify-between rounded-xl border border-line-rose bg-[var(--c-tint)] px-4 py-3">
              <span className="text-[12.5px] font-bold text-ink">Recharge Balance</span>
              <span
                className={`text-[14.5px] font-extrabold ${
                  rechargeShort ? "text-red-600" : "text-maroon-700"
                }`}
              >
                {fmt(wallet.rechargeBalance)}
              </span>
            </div>
            {rechargeShort ? (
              <div className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] font-semibold leading-relaxed text-red-600">
                Insufficient recharge balance — plans are bought with recharge money only
                (income &amp; balance are withdrawable, not spendable).
              </div>
            ) : (
              <div className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted-rose">
                Plan purchase uses recharge balance only — income &amp; balance stay
                withdrawable.
              </div>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="flex-1 cursor-pointer rounded-[14px] border border-line-rose bg-[var(--c-tint)] py-3.5 text-[15px] font-bold text-[#7d6a6e]"
              >
                Cancel
              </button>
              {rechargeShort ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlan(null);
                    router.push("/recharge");
                  }}
                  className={`flex-[2] cursor-pointer rounded-[14px] py-3.5 text-[15px] font-extrabold text-white ${gradientBtn}`}
                >
                  Recharge Now →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPlan;
                    setSelectedPlan(null);
                    buyPlan(p);
                  }}
                  className={`flex-[2] cursor-pointer rounded-[14px] py-3.5 text-[15px] font-extrabold text-white ${gradientBtn}`}
                >
                  Confirm →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== WELCOME NOTICE ===== */}
      {notice && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5"
          onClick={() => setNotice(false)}
        >
          <div
            className="w-full max-w-[370px] animate-[pop-in_0.25s_ease] overflow-hidden rounded-[24px] bg-white shadow-[0_20px_60px_var(--s-alert)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-[linear-gradient(135deg,var(--c-deep)_0%,var(--c-primary2)_100%)] px-5 pb-5 pt-7 text-center">
              <button
                type="button"
                aria-label="Close notice"
                onClick={() => setNotice(false)}
                className="absolute right-3 top-3 grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[10px] bg-white/15 text-white/80"
              >
                <X size={17} />
              </button>
              <div className="relative mx-auto mb-3 h-[60px] w-[60px] overflow-hidden rounded-2xl bg-white ring-2 ring-gold/50">
                <Image src={logo} alt="Saudi Aramco" fill sizes="60px" className="object-cover" />
              </div>
              <div className="font-display text-[20px] font-bold text-white">
                {popupCfg.title || "Welcome"}
              </div>
              <div className="mt-1 text-[13px] text-white/65">{popupCfg.subtitle}</div>
            </div>
            {popupCfg.bullets.length > 0 && (
              <div className="px-4 pt-4">
                <ul className="flex flex-col gap-2">
                  {popupCfg.bullets.map((b, i) => {
                    const Ico = POPUP_ICONS[b.icon] || CircleCheck;
                    return (
                      <li
                        key={b.text + "-" + i}
                        className="flex items-center gap-2.5 rounded-xl border border-line-rose bg-[var(--c-tint)] px-3.5 py-2.5 text-[13px] font-medium text-ink"
                      >
                        <Ico size={17} className="shrink-0 text-maroon-600" />
                        {b.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="p-4">
              <button
                type="button"
                onClick={() => {
                  if (popupCfg.buttonUrl) window.open(popupCfg.buttonUrl, "_blank");
                  else showToast("Telegram channel link coming soon");
                }}
                className={`block w-full cursor-pointer rounded-[14px] py-3 text-center text-[14px] font-extrabold text-white ${gradientBtn}`}
              >
                {popupCfg.buttonText || "Join Telegram Channel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TOAST ===== */}
      <Toast message={toast} />
    </div>
  );
}

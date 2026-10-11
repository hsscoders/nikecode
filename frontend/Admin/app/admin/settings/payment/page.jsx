"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Save,
  Info,
  KeyRound,
  PlugZap,
  Eye,
  EyeOff,
  ShieldCheck,
  Landmark,
  Wallet,
  RefreshCw,
  Snowflake,
  Ban,
  Radar,
  Search,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock3,
  Layers,
  Globe,
  Copy,
  CircleAlert,
  Zap,
} from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  Select,
  Loader,
  Toast,
  useToast,
  Switch,
} from "../../../../components/ui";

/* ============ GATEWAY DISPLAY REGISTRY ============
   One row per integrated automatic gateway. Adding the next gateway =
   one entry here — its selector button, its 3 setup steps, the webhook
   list, the payout menus and the order query console all render from it. */
const GATEWAY_META = [
  {
    id: "qwackpay",
    label: "QwackPay",
    tag: "UPI Collection + Bank Payout · India",
    defaultName: "QwackPay",
    defaultBase: "https://qwackpay.com/api/v1",
    idLabel: "Merchant ID",
    idHint: "Example — 681551699",
    idPlaceholder: "681551699",
    keyLabel: "API Key (docking key)",
    keyHint: "From the merchant dashboard — change it anytime",
    keyPlaceholder: "Paste the docking key",
    fees: ["Collection fee 7%", "Payout fee 3% + ₹6", "₹100 – ₹1,00,000"],
  },
  {
    id: "okpay",
    label: "OKPay",
    tag: "UPI Collection + Bank Payout · India",
    defaultName: "OKPay",
    defaultBase: "https://api.wpay.one",
    idLabel: "Merchant ID (mchId)",
    idHint: "From the OKPay merchant dashboard",
    idPlaceholder: "e.g. 1000",
    keyLabel: "Private Key",
    keyHint: "From the OKPay merchant dashboard — change it anytime",
    keyPlaceholder: "Paste the private key",
    fees: ["Recharge credited by pay_money", "IP whitelist required", "₹100 – ₹1,00,000"],
  },
];

const emptyCfg = (m) => ({
  enabled: false,
  autoPayout: false,
  displayName: m.defaultName,
  merchantId: "",
  apiKey: "",
  baseUrl: m.defaultBase,
});

/* top-level tabs — the page is broken into clear parts */
const TABS = [
  { id: "gateways", label: "Gateways", short: "Gateways", Icon: Layers },
  { id: "urls", label: "Server & Webhooks", short: "Webhooks", Icon: Globe },
  { id: "query", label: "Order Query", short: "Query", Icon: Radar },
];

/* gateway order status → pill (order query result) */
function OrderStatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const paid = s === "success" || s === "completed" || s === "paid";
  const failed = s === "failed" || s === "rejected" || s === "cancelled";
  const cls = paid
    ? "bg-[#eafaf0] text-[#16a34a]"
    : failed
    ? "bg-[#fdecec] text-[#dc2626]"
    : "bg-[#fdf6e4] text-[#8a6a1c]";
  const Icon = paid ? CheckCircle2 : failed ? XCircle : Clock3;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.4px] ${cls}`}>
      <Icon size={14} />
      {status || "Unknown"}
    </span>
  );
}

/* small on/off chip used across the page */
function Chip({ on, onText, offText, tone = "green" }) {
  const cls = on
    ? tone === "green"
      ? "bg-[#eafaf0] text-[#16a34a]"
      : tone === "blue"
      ? "bg-[#e8f0fe] text-[#2563eb]"
      : "bg-[#fdf6e4] text-[#8a6a1c]"
    : "bg-[#f3eef0] text-[#9a8b90]";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.4px] ${cls}`}>
      {on ? onText : offText}
    </span>
  );
}

/* numbered step header — "parts by parts" setup */
function StepHead({ n, Icon, title, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="font-display grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-[13px] font-extrabold text-white shadow-[0_4px_10px_rgba(124,29,51,0.3)] sm:h-8 sm:w-8 sm:text-[14px]">
          {n}
        </span>
        <Icon size={17} className="h-4 w-4 text-maroon-700 sm:h-[17px] sm:w-[17px]" />
        <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">{title}</div>
      </div>
      {right}
    </div>
  );
}

export default function PaymentGatewayPage() {
  const [tab, setTab] = useState("gateways"); // gateways | urls | query
  const [selGw, setSelGw] = useState("qwackpay"); // gateway the buttons switch
  const [cfgs, setCfgs] = useState(null); // { qwackpay: {...}, okpay: {...} }
  const [showKeys, setShowKeys] = useState({});
  const [advOpen, setAdvOpen] = useState({}); // per-gw advanced (base url)
  const [saving, setSaving] = useState(false);
  const [bals, setBals] = useState({}); // per-gateway { available, frozen, total }
  const [testing, setTesting] = useState({}); // per-gateway busy flag
  const [gwList, setGwList] = useState(null); // registry gateways + live balances
  const [defaultGw, setDefaultGw] = useState("qwackpay"); // payout default
  /* global public URLs (auto-detected, editable once, shared by all gateways) */
  const [urls, setUrls] = useState({ backendUrl: "", clientUrl: "" });
  const [detected, setDetected] = useState({ backendUrl: "", clientUrl: "" });
  const [copied, setCopied] = useState("");
  /* order query tool state */
  const [qId, setQId] = useState("");
  const [qGw, setQGw] = useState("qwackpay");
  const [qBusy, setQBusy] = useState(false);
  const [qResult, setQResult] = useState(null);
  const [qError, setQError] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [recents, setRecents] = useState([]);
  const { toast, showToast, isError } = useToast();

  const loadGateways = async () => {
    try {
      const d = await api("/api/admin/payout-gateways");
      setGwList(d.gateways || []);
      const def = (d.gateways || []).find((g) => g.isDefault);
      if (def) setDefaultGw(def.id);
    } catch (e) {
      setGwList([]);
    }
  };

  /* recent gateway orders — one-tap fill for the order query tool */
  const loadRecents = async () => {
    try {
      const [d, w] = await Promise.all([
        api("/api/admin/deposits?status=Pending"),
        api("/api/admin/withdrawals?status=Processing"),
      ]);
      const items = [
        ...(d.deposits || [])
          .filter((x) => x.gateway)
          .slice(0, 5)
          .map((x) => ({
            id: x._id,
            label: "\u20B9" + Number(x.amount).toLocaleString("en-IN"),
            sub: x.phone + " · " + (x.gateway === "okpay" ? "OKPay" : "QwackPay") + " recharge",
          })),
        ...(w.withdrawals || [])
          .filter((x) => x.autoPayout)
          .slice(0, 5)
          .map((x) => ({
            id: x.payoutOrderId || x._id,
            label: "\u20B9" + Number(x.netAmount ?? x.amount).toLocaleString("en-IN"),
            sub: x.phone + " · " + (x.gateway === "okpay" ? "OKPay" : "QwackPay") + " payout",
          })),
      ];
      setRecents(items.slice(0, 8));
    } catch (e) {
      /* cosmetic — ignore */
    }
  };

  useEffect(() => {
    document.title = "Payment Gateway";
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const s = (d.settings && d.settings) || {};
        setCfgs(
          GATEWAY_META.reduce((acc, m) => {
            const q = s[m.id] || {};
            acc[m.id] = {
              enabled: !!q.enabled,
              autoPayout: !!q.autoPayout,
              displayName: q.displayName || m.defaultName,
              merchantId: q.merchantId || q.mchId || "",
              apiKey: q.apiKey || "",
              baseUrl: q.baseUrl || m.defaultBase,
            };
            return acc;
          }, {})
        );
        setDetected(d.detectedUrls || { backendUrl: "", clientUrl: "" });
        const eff = d.effectiveUrls || {};
        setUrls({
          backendUrl: eff.backendUrl || "",
          clientUrl: eff.clientUrl || "",
        });
        loadGateways();
        loadRecents();
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCfg = (id, patch) =>
    setCfgs((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  const save = async () => {
    for (const m of GATEWAY_META) {
      const c = cfgs[m.id];
      if (c.enabled && (!c.merchantId.trim() || !c.apiKey.trim()))
        return showToast("Step 1 — enter the " + m.label + " merchant ID and key before enabling it", true);
    }
    setSaving(true);
    try {
      const body = {
        publicUrls: {
          backendUrl: urls.backendUrl.trim(),
          clientUrl: urls.clientUrl.trim(),
        },
        gatewayPrefs: { defaultPayoutGateway: defaultGw },
      };
      for (const m of GATEWAY_META) {
        const c = cfgs[m.id];
        body[m.id] = {
          enabled: c.enabled,
          autoPayout: c.autoPayout,
          displayName: c.displayName.trim() || m.defaultName,
          ...(m.id === "okpay" ? { mchId: c.merchantId.trim() } : { merchantId: c.merchantId.trim() }),
          apiKey: c.apiKey.trim(),
          baseUrl: c.baseUrl.trim() || m.defaultBase,
        };
      }
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const liveOn = GATEWAY_META.filter((m) => cfgs[m.id].enabled).map((m) => cfgs[m.id].displayName.trim() || m.defaultName);
      showToast(
        liveOn.length
          ? "Saved — " + liveOn.join(" + ") + " live on the /recharge page"
          : "Saved — URLs stored, the auto methods stay hidden until you enable a gateway"
      );
      loadGateways();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  /* live check — hits the gateway /balance endpoint with the saved key */
  const checkBalance = async (gwId, silent = false) => {
    setTesting((t) => ({ ...t, [gwId]: true }));
    try {
      const d = await api("/api/admin/qwackpay/test", {
        method: "POST",
        body: JSON.stringify({ gateway: gwId }),
      });
      if (d.balance) setBals((b) => ({ ...b, [gwId]: d.balance }));
      if (!silent) showToast(d.message + (d.balance ? " — balance loaded" : ""));
    } catch (e) {
      setBals((b) => ({ ...b, [gwId]: null }));
      if (!silent) showToast(e.message, true);
    } finally {
      setTesting((t) => ({ ...t, [gwId]: false }));
    }
  };

  /* ============ ORDER QUERY (order/query console) ============ */
  const runQuery = async (rawId) => {
    const id = String(rawId ?? qId).trim();
    if (!id) return showToast("Enter an order id first", true);
    setQId(id);
    setQBusy(true);
    setQResult(null);
    setQError("");
    try {
      const d = await api("/api/admin/qwackpay/query-order", {
        method: "POST",
        body: JSON.stringify({ orderId: id, gateway: qGw }),
      });
      setQResult(d);
      if (d.settled && d.settled !== "not-applicable") {
        showToast(d.message);
        loadRecents();
      }
    } catch (e) {
      setQError(e.message);
    } finally {
      setQBusy(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(""), 1500);
    } catch (e) {}
  };

  const money = (v) =>
    "\u20B9" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  /* per-gateway live info from the registry endpoint */
  const gwInfo = (id) => (gwList || []).find((g) => g.id === id) || null;

  /* effective backend origin (saved ?? detected) — drives the webhook hints */
  const effBackend = (urls.backendUrl || detected.backendUrl || "").replace(/\/+$/, "");
  const effClient = (urls.clientUrl || detected.clientUrl || "").replace(/\/+$/, "");

  /* connection state per gateway — drives the selector + step-1 chips */
  const setupState = (id) => {
    const c = cfgs[id];
    const credsOk = !!(c.merchantId.trim() && c.apiKey.trim());
    if (!credsOk) return { key: "no-creds", text: "Credentials missing", cls: "bg-[#f3eef0] text-[#9a8b90]" };
    if (!effBackend) return { key: "no-url", text: "Set Server URL", cls: "bg-[#fdf6e4] text-[#8a6a1c]" };
    return { key: "ok", text: "Connected", cls: "bg-[#eafaf0] text-[#16a34a]" };
  };

  return (
    <AdminShell
      title="Payment Gateway"
      sub="Automatic gateways in 3 steps — pick a gateway, connect it, then switch collection & payout on"
    >
      <Toast message={toast} isError={isError} />

      {!cfgs ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[880px] flex-col gap-3.5 sm:gap-5">
          {/* ===== TOP TABS — the parts of this console ===== */}
          <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:gap-2">
            {TABS.map(({ id, label, short, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11.5px] font-extrabold transition-all duration-150 sm:justify-start sm:gap-2 sm:px-5 sm:py-3 sm:text-[13.5px] ${
                  tab === id
                    ? "bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-white shadow-[0_6px_16px_rgba(124,29,51,0.3)]"
                    : "border border-line-rose bg-white text-[#7d6a6e] hover:bg-[#fbf1f3]"
                }`}
              >
                <Icon size={16} className="h-[14px] w-[14px] sm:h-4 sm:w-4" />
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ================================================================
              TAB 1 — GATEWAYS (selector buttons + the selected gateway's 3 steps)
          ================================================================= */}
          {tab === "gateways" && (
            <>
              {/* gateway selector — click a button to open its setup */}
              <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers size={17} className="text-maroon-700" />
                    <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                      Choose a Gateway
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost px-4 py-2 text-[12px]"
                    onClick={loadGateways}
                  >
                    <RefreshCw size={13} />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GATEWAY_META.map((meta) => {
                    const c = cfgs[meta.id];
                    const info = gwInfo(meta.id);
                    const st = setupState(meta.id);
                    const active = selGw === meta.id;
                    return (
                      <button
                        key={meta.id}
                        type="button"
                        onClick={() => setSelGw(meta.id)}
                        className={`flex cursor-pointer flex-col gap-2.5 rounded-xl border-2 p-3 text-left transition-all duration-150 sm:gap-3 sm:rounded-2xl sm:p-4 ${
                          active
                            ? "border-maroon-700 bg-[#fbf1f3] shadow-[0_8px_20px_rgba(124,29,51,0.15)]"
                            : "border-line-rose bg-white hover:border-maroon-700/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${active ? "bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-white" : "bg-[#f7e3e7] text-maroon-700"}`}>
                            <CreditCard size={20} className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13.5px] font-extrabold text-ink sm:text-[15px]">{meta.label}</span>
                              {active && <CheckCircle2 size={15} className="text-maroon-700" />}
                            </div>
                            <div className="truncate text-[11px] font-semibold text-[#9a8b90]">{meta.tag}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.4px] ${st.cls}`}>
                            {st.text}
                          </span>
                          <Chip on={c.enabled} onText="Collection ON" offText="Collection OFF" />
                          <Chip on={c.autoPayout} onText="Payout ON" offText="Payout OFF" tone="blue" />
                          {info && info.ready && info.balance ? (
                            <span className="rounded-full bg-[#eafaf0] px-2.5 py-1 text-[10.5px] font-extrabold text-[#16a34a]">
                              {money(info.balance.available)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-[#fbf3f4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#7d6a6e]">
                  <Info size={15} className="mt-0.5 shrink-0 text-maroon-600" />
                  <span>
                    Every gateway is set up the same 3-step way: connect the
                    credentials, turn recharge collection on, then turn automatic
                    payout on. New gateways appear here automatically once they are
                    integrated.
                  </span>
                </div>
              </div>

              {/* ===== SELECTED GATEWAY — 3 STEPS ===== */}
              {GATEWAY_META.filter((m) => m.id === selGw).map((meta) => {
                const c = cfgs[meta.id];
                const bal = bals[meta.id];
                const busy = !!testing[meta.id];
                const st = setupState(meta.id);
                return (
                  <div key={meta.id} className="flex flex-col gap-5">
                    {/* — STEP 1 · CONNECT — */}
                    <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                      <StepHead
                        n={1}
                        Icon={KeyRound}
                        title={"Connect " + meta.label}
                        right={
                          <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.4px] ${st.cls}`}>
                            {st.text}
                          </span>
                        }
                      />
                      <div className="text-[12px] font-medium leading-relaxed text-muted-rose sm:text-[12.5px]">
                        Paste the merchant ID and the key from the {meta.label}{" "}
                        merchant dashboard, then press{" "}
                        <span className="font-bold text-maroon-700">Test Connection</span> — it
                        talks to the live gateway and loads your merchant balance.
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                        <Field label={meta.idLabel} hint={meta.idHint}>
                          <TextInput
                            value={c.merchantId}
                            onChange={(e) => setCfg(meta.id, { merchantId: e.target.value })}
                            placeholder={meta.idPlaceholder}
                          />
                        </Field>
                        <Field label={meta.keyLabel} hint={meta.keyHint}>
                          <div className="relative">
                            <TextInput
                              type={showKeys[meta.id] ? "text" : "password"}
                              value={c.apiKey}
                              onChange={(e) => setCfg(meta.id, { apiKey: e.target.value })}
                              placeholder={meta.keyPlaceholder}
                              autoComplete="new-password"
                              className="pr-11"
                            />
                            <button
                              type="button"
                              aria-label={showKeys[meta.id] ? "Hide key" : "Show key"}
                              onClick={() => setShowKeys((s) => ({ ...s, [meta.id]: !s[meta.id] }))}
                              className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-lg bg-[#fbf3f4] text-maroon-700"
                            >
                              {showKeys[meta.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </Field>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary px-5"
                          onClick={() => checkBalance(meta.id)}
                          disabled={busy}
                        >
                          <PlugZap size={15} className={busy ? "animate-pulse" : ""} />
                          {busy ? "Testing..." : "Test Connection"}
                        </button>
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-1 text-[12px] font-bold text-maroon-700"
                          onClick={() => setAdvOpen((a) => ({ ...a, [meta.id]: !a[meta.id] }))}
                        >
                          <ChevronDown size={13} className={`transition-transform ${advOpen[meta.id] ? "rotate-180" : ""}`} />
                          Advanced — API base URL
                        </button>
                      </div>

                      {advOpen[meta.id] && (
                        <Field label="Gateway API Base URL" hint={"Default — " + meta.defaultBase}>
                          <TextInput
                            value={c.baseUrl}
                            onChange={(e) => setCfg(meta.id, { baseUrl: e.target.value })}
                            placeholder={meta.defaultBase}
                          />
                        </Field>
                      )}

                      {bal ? (
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="rounded-xl bg-[#eafaf0] px-2.5 py-2.5 sm:px-4 sm:py-3.5">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#16a34a] sm:gap-1.5 sm:text-[11.5px]">
                              <Wallet size={13} /> Available
                            </div>
                            <div className="font-display mt-0.5 truncate text-[14px] font-extrabold text-[#15803d] sm:mt-1 sm:text-[20px]" title={money(bal.available)}>
                              {money(bal.available)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#e8f0fe] px-2.5 py-2.5 sm:px-4 sm:py-3.5">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#2563eb] sm:gap-1.5 sm:text-[11.5px]">
                              <Snowflake size={13} /> Frozen
                            </div>
                            <div className="font-display mt-0.5 truncate text-[14px] font-extrabold text-[#1d4ed8] sm:mt-1 sm:text-[20px]" title={money(bal.frozen)}>
                              {money(bal.frozen)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#f7e3e7] px-2.5 py-2.5 sm:px-4 sm:py-3.5">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-maroon-700 sm:gap-1.5 sm:text-[11.5px]">
                              <Ban size={13} /> Total
                            </div>
                            <div className="font-display mt-0.5 truncate text-[14px] font-extrabold text-maroon-700 sm:mt-1 sm:text-[20px]" title={money(bal.total)}>
                              {money(bal.total)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        !busy && (
                          <div className="rounded-xl bg-[#fbf3f4] px-3 py-2.5 sm:px-4 sm:py-3 text-center text-[12px] font-medium text-muted-rose">
                            Balance appears here after a successful Test Connection.
                          </div>
                        )
                      )}

                      <div className="flex items-start gap-3 rounded-xl bg-[#fbf3f4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#7d6a6e]">
                        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-maroon-600" />
                        <span>
                          The key is stored server-side only — it never reaches the browser
                          or any public API response. All signed gateway calls happen from
                          this backend.
                        </span>
                      </div>
                    </div>

                    {/* — STEP 2 · RECHARGE COLLECTION — */}
                    <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                      <StepHead
                        n={2}
                        Icon={CreditCard}
                        title="Recharge Collection"
                        right={<Chip on={c.enabled} onText="ON" offText="OFF" />}
                      />
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line-rose bg-white p-3.5 sm:gap-4 sm:p-4">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-ink sm:text-[14px]">
                            Enable {meta.label} collection
                          </div>
                          <div className="mt-1 text-[12px] font-medium leading-relaxed text-muted-rose sm:text-[12.5px]">
                            When ON, a payment method with an AUTO badge appears on the
                            client /recharge page under the display name below. Users pay on
                            the hosted UPI checkout and the wallet is credited automatically
                            by the signed webhook — no manual approval.
                          </div>
                        </div>
                        <Switch
                          checked={c.enabled}
                          onChange={(v) => setCfg(meta.id, { enabled: v })}
                        />
                      </div>
                      <Field
                        label="Display Name on /recharge"
                        hint="The payment method label users see on the recharge page — rename anytime"
                      >
                        <TextInput
                          value={c.displayName}
                          onChange={(e) => setCfg(meta.id, { displayName: e.target.value })}
                          placeholder={meta.defaultName}
                          maxLength={40}
                        />
                      </Field>
                      {!effBackend && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-[#f0d9a8] bg-[#fdf6e4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12.5px] font-semibold text-[#8a6a1c]">
                          <CircleAlert size={15} className="mt-0.5 shrink-0" />
                          Collection also needs the public server URL — open the{" "}
                          <button type="button" className="cursor-pointer font-extrabold underline" onClick={() => setTab("urls")}>
                            Server &amp; Webhooks
                          </button>{" "}
                          tab. It is detected automatically from this server&apos;s domain.
                        </div>
                      )}
                    </div>

                    {/* — STEP 3 · AUTOMATIC PAYOUT — */}
                    <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                      <StepHead
                        n={3}
                        Icon={Landmark}
                        title="Automatic Payout"
                        right={<Chip on={c.autoPayout} onText="ON" offText="OFF" tone="blue" />}
                      />
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line-rose bg-white p-3.5 sm:gap-4 sm:p-4">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-ink sm:text-[14px]">
                            Enable {meta.label} payouts
                          </div>
                          <div className="mt-1 text-[12px] font-medium leading-relaxed text-muted-rose sm:text-[12.5px]">
                            When ON, <span className="font-bold text-maroon-700">Auto Pay</span>{" "}
                            becomes available on Admin → Withdrawals. One click sends the net
                            amount straight to the user&apos;s bank account — the signed
                            webhook settles the withdrawal automatically (failed payouts refund
                            the user instantly). Manual Approve / Reject keeps working either
                            way.
                          </div>
                        </div>
                        <Switch
                          checked={c.autoPayout}
                          onChange={(v) => setCfg(meta.id, { autoPayout: v })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.fees.map((f) => (
                          <span key={f} className="rounded-full bg-[#f7e3e7] px-2.5 py-1 text-[11px] font-bold text-maroon-700">
                            {f}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-start gap-3 rounded-xl bg-[#fbf3f4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#7d6a6e]">
                        <Wallet size={15} className="mt-0.5 shrink-0 text-maroon-600" />
                        <span>
                          Auto payouts spend the merchant balance loaded in Step 1 — keep it
                          funded before using Auto Pay. The gateway rejects payouts when the
                          balance is insufficient, and your server IP must be whitelisted in
                          the {meta.label} dashboard.
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* — payout default (all gateways) — */}
              <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Landmark size={17} className="text-maroon-700" />
                  <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                    Default Payout Gateway
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <Field
                    label="Preselected gateway on Withdrawals"
                    hint="Auto Pay opens with this gateway selected — changeable per payout"
                  >
                    <Select
                      value={defaultGw}
                      onChange={(e) => setDefaultGw(e.target.value)}
                    >
                      {(gwList || GATEWAY_META.map((m) => ({ id: m.id, label: m.label }))).map(
                        (g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                            {g.balance ? " — " + money(g.balance.available) : g.ready === false ? " — not ready" : ""}
                          </option>
                        )
                      )}
                    </Select>
                  </Field>
                  <div className="rounded-xl bg-[#fbf3f4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#7d6a6e]">
                    On the Withdrawals page the admin picks the gateway per payout — this
                    default just saves one tap. New gateways appear in that menu
                    automatically once their payout is enabled.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ================================================================
              TAB 2 — SERVER & WEBHOOKS (auto-detected URLs + endpoint list)
          ================================================================= */}
          {tab === "urls" && (
            <>
              <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe size={17} className="text-maroon-700" />
                    <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                      Public URLs
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost px-4 py-2 text-[12px]"
                    onClick={() =>
                      setUrls((u) => ({
                        backendUrl: detected.backendUrl || u.backendUrl,
                        clientUrl: detected.clientUrl || u.clientUrl,
                      }))
                    }
                  >
                    <RefreshCw size={13} />
                    Re-detect from server
                  </button>
                </div>

                <div className="text-[12px] font-medium leading-relaxed text-muted-rose sm:text-[12.5px]">
                  These two URLs are <span className="font-bold text-maroon-700">picked up
                  automatically from this server&apos;s domain</span> — no typing needed. They
                  are saved once and <span className="font-bold">every gateway reuses them</span>{" "}
                  for its payment callback and redirect. Edit only if the site runs behind a
                  custom domain that is different from the detected one.
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <Field
                    label="Backend Public URL"
                    hint="Where the gateways deliver payment + payout webhooks"
                  >
                    <div className="relative">
                      <TextInput
                        value={urls.backendUrl}
                        onChange={(e) => setUrls((u) => ({ ...u, backendUrl: e.target.value }))}
                        placeholder="https://api.yourdomain.com"
                      />
                      {detected.backendUrl && urls.backendUrl === detected.backendUrl && (
                        <span className="absolute -top-2 right-2 rounded-full bg-[#eafaf0] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#16a34a]">
                          auto-detected
                        </span>
                      )}
                    </div>
                  </Field>
                  <Field
                    label="Website Public URL"
                    hint="Where users land after paying — /recharge?paid=…"
                  >
                    <div className="relative">
                      <TextInput
                        value={urls.clientUrl}
                        onChange={(e) => setUrls((u) => ({ ...u, clientUrl: e.target.value }))}
                        placeholder="https://www.yourdomain.com"
                      />
                      {detected.clientUrl && urls.clientUrl === detected.clientUrl && (
                        <span className="absolute -top-2 right-2 rounded-full bg-[#eafaf0] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#16a34a]">
                          auto-detected
                        </span>
                      )}
                    </div>
                  </Field>
                </div>

                {detected.backendUrl ? (
                  <div className="flex items-start gap-3 rounded-xl bg-[#eafaf0]/70 px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#15803d]">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    <span>
                      Detected from the server domain — Backend{" "}
                      <span className="font-bold">{detected.backendUrl}</span>
                      {detected.clientUrl && (
                        <>
                          {" "}· Website <span className="font-bold">{detected.clientUrl}</span>
                        </>
                      )}
                      . Press Save to store them (they stay up to date when the domain
                      changes — just press Re-detect).
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl bg-[#fdf6e4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#8a6a1c]">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    <span>
                      The server could not detect the public domain from this request — type
                      the URLs once (they must start with https:// and be reachable from the
                      internet).
                    </span>
                  </div>
                )}
              </div>

              {/* webhook endpoints — computed from the effective backend URL */}
              <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <PlugZap size={17} className="text-maroon-700" />
                  <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                    Webhook Endpoints
                  </div>
                </div>
                <div className="text-[12px] font-medium leading-relaxed text-muted-rose sm:text-[12.5px]">
                  If a gateway dashboard asks for a notify / webhook address, set the
                  matching endpoint below (collection = payments in, payout = withdrawals
                  out). Copy with one tap.
                </div>
                {GATEWAY_META.map((meta) => (
                  <div key={meta.id} className="rounded-xl border border-line-rose bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <CreditCard size={14} className="text-maroon-700" />
                      <span className="text-[13px] font-extrabold text-ink">{meta.label}</span>
                    </div>
                    {[
                      { k: "Collection", path: "/api/payments/" + meta.id + "/notify" },
                      { k: "Payout", path: "/api/payments/" + meta.id + "/payout-notify" },
                    ].map(({ k, path }) => {
                      const full = effBackend + path;
                      return (
                        <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-1">
                          <span className="w-[60px] shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-[#9a8b90] sm:w-[80px] sm:text-[11px]">
                            {k}
                          </span>
                          <span className="min-w-0 flex-1 truncate rounded-lg bg-[#fbf3f4] px-3 py-1.5 text-[11px] font-bold text-[#7d6a6e] sm:text-[11.5px]">
                            {full || "— set the Backend Public URL above —"}
                          </span>
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost px-3 py-1.5 text-[11.5px]"
                            onClick={() => copy(full)}
                            disabled={!effBackend}
                          >
                            <Copy size={12} />
                            {copied === full ? "Copied" : "Copy"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* security — IP whitelist + key storage */}
              <div className="admin-card flex flex-col gap-2.5 p-3.5 sm:gap-3 sm:p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-maroon-700" />
                  <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                    Security Checklist
                  </div>
                </div>
                {[
                  "Add this server's public IP to the whitelist in every gateway dashboard — payouts from non-whitelisted IPs are rejected (OKPay reports code 16).",
                  "Both URLs must start with https:// and be reachable from the internet — the gateways call them to settle payments.",
                  "API keys are stored server-side only and never appear in any public response; signed webhooks are verified before a single rupee is credited.",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3 rounded-xl bg-[#fbf3f4] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#7d6a6e]">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0 text-maroon-600" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ================================================================
              TAB 3 — ORDER QUERY (live gateway order/query console)
          ================================================================= */}
          {tab === "query" && (
            <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Radar size={17} className="text-maroon-700" />
                  <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                    Order Status Query
                  </div>
                </div>
                <span className="rounded-full bg-[#fbf1f3] px-3 py-1 text-[11px] font-bold text-maroon-700">
                  live gateway check
                </span>
              </div>

              <div className="text-[12px] font-medium leading-relaxed text-muted-rose sm:text-[12.5px]">
                Ask the gateway directly for the live status of any order — recharge
                order id, withdrawal id, payout order id (WD…) or the gateway&apos;s own
                order id. If the gateway reports a final result, the local record is
                settled automatically (credited / closed / refunded) — even when a
                webhook was missed.
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={qGw}
                  onChange={(e) => setQGw(e.target.value)}
                  className="sm:w-[190px]"
                  aria-label="Gateway"
                >
                  {(gwList || GATEWAY_META.map((m) => ({ id: m.id, label: m.label }))).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                      {g.ready === false ? " (not ready)" : ""}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-[#fbf3f4] px-3 py-2 focus-within:ring-[3px] focus-within:ring-maroon-600/15 sm:px-3.5 sm:py-2.5">
                  <Search size={15} className="shrink-0 text-icon-rose" />
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-[#bd9fa6]"
                    value={qId}
                    onChange={(e) => setQId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runQuery()}
                    placeholder="Paste an order id…"
                    aria-label="Order id"
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary shrink-0 px-5"
                  onClick={() => runQuery()}
                  disabled={qBusy}
                >
                  <Radar size={14} className={qBusy ? "animate-spin" : ""} />
                  {qBusy ? "Querying..." : "Query"}
                </button>
              </div>

              {recents.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-[#8a6e75]">
                    Recent:
                  </span>
                  {recents.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={r.id}
                      onClick={() => runQuery(r.id)}
                      className="max-w-[240px] cursor-pointer truncate rounded-full border border-line-rose bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink transition-colors hover:bg-[#fbf1f3]"
                    >
                      {r.label} · {r.sub}
                    </button>
                  ))}
                </div>
              )}

              {qError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[#f3c8c8] bg-[#fdecec] px-3 py-2.5 sm:px-4 sm:py-3 text-[12.5px] font-semibold text-[#b91c1c]">
                  <XCircle size={15} className="mt-0.5 shrink-0" />
                  {qError}
                </div>
              )}

              {qResult && (
                <div className="flex flex-col gap-3 rounded-xl border border-line-rose bg-[#fdfafb] p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <OrderStatusPill status={qResult.order.status} />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[#e8f0fe] px-2.5 py-1 text-[10.5px] font-extrabold uppercase text-[#2563eb]">
                        {qResult.kind}
                      </span>
                      {qResult.settled !== "not-applicable" && (
                        <span className="rounded-full bg-[#eafaf0] px-2.5 py-1 text-[10.5px] font-extrabold uppercase text-[#16a34a]">
                          settled: {qResult.settled.replace(/-/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#9a8b90]">Amount</div>
                      <div className="font-display mt-0.5 text-[15px] font-extrabold text-ink">
                        {qResult.order.amount != null ? money(qResult.order.amount) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#9a8b90]">UTR</div>
                      <div className="mt-0.5 break-all font-bold text-ink">{qResult.order.utr || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#9a8b90]">Gateway Order</div>
                      <div className="mt-0.5 break-all font-bold text-ink">
                        {qResult.order.gatewayOrderId || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="break-all rounded-lg bg-[#fbf3f4] px-3 py-2 text-[11.5px] font-bold text-[#7d6a6e]">
                    merchant order id: {qResult.order.merchantOrderId}
                  </div>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-1 self-start text-[12px] font-bold text-maroon-700"
                    onClick={() => setShowRaw((s) => !s)}
                  >
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${showRaw ? "rotate-180" : ""}`}
                    />
                    {showRaw ? "Hide raw response" : "Show raw gateway response"}
                  </button>
                  {showRaw && (
                    <pre className="max-h-[220px] overflow-auto rounded-lg bg-[#2d1218] p-3 text-[11px] leading-relaxed text-[#f3d9de]">
                      {JSON.stringify(qResult.raw, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== STICKY SAVE — saves whichever tab you are on ===== */}
          <div className="sticky bottom-3 flex flex-wrap items-center justify-end gap-3 sm:bottom-4">
            <div className="hidden items-center gap-2 rounded-xl border border-line-rose bg-white/95 px-4 py-2.5 text-[12px] font-semibold text-muted-rose shadow-[0_8px_20px_rgba(124,29,51,0.08)] backdrop-blur sm:flex">
              <Zap size={13} className="text-maroon-600" />
              Saves gateways, public URLs and the payout default together
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-primary w-full px-6 shadow-[0_10px_26px_rgba(124,29,51,0.35)] sm:w-auto sm:px-8"
              onClick={save}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Gateway Settings"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

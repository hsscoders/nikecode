"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Save,
  Plus,
  Trash2,
  Smartphone,
  Landmark,
  Wallet,
  CreditCard,
  IndianRupee,
  MessageCircle,
  QrCode,
  ArrowDownToLine,
  Percent,
  Zap,
  Upload,
  CreditCard as GatewayIcon,
} from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  TextArea,
  Switch,
  Loader,
  Toast,
  useToast,
} from "../../../../components/ui";

/* Icon options — client app renders lucide icons from these keys */
const METHOD_ICONS = [
  { key: "smartphone", Icon: Smartphone },
  { key: "landmark", Icon: Landmark },
  { key: "wallet", Icon: Wallet },
  { key: "credit-card", Icon: CreditCard },
  { key: "rupee", Icon: IndianRupee },
  { key: "message", Icon: MessageCircle },
];

const MAX_METHODS = 6;
const MAX_QUICK = 6;

export default function RechargeSettingsPage() {
  const [cfg, setCfg] = useState(null);
  const [quickText, setQuickText] = useState("");
  /* auto-gateway display names on /recharge — one per integrated gateway */
  const [gwNames, setGwNames] = useState({ qwackpay: "QwackPay", okpay: "OKPay" });
  const [gwEnabled, setGwEnabled] = useState({ qwackpay: false, okpay: false });
  const GW_META = [
    { id: "qwackpay", label: "QwackPay", def: "QwackPay" },
    { id: "okpay", label: "OKPay", def: "OKPay" },
  ];
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pick, setPick] = useState(null); // open icon-picker row index
  const fileRef = useRef(null);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const r = d.settings && d.settings.recharge ? d.settings.recharge : {};
        const built = {
          minAmount: 530,
          maxAmount: 50000,
          quickAmounts: [600, 2200],
          methods: [],
          ...r,
          manual: {
            enabled: true,
            title: "Manual Payment",
            upiId: "",
            accountName: "",
            qrImage: "",
            note: "",
            ...(r.manual || {}),
          },
        };
        setCfg(built);
        setQuickText((built.quickAmounts || []).join(", "));
        const s = d.settings || {};
        setGwNames({
          qwackpay: (s.qwackpay && s.qwackpay.displayName) || "QwackPay",
          okpay: (s.okpay && s.okpay.displayName) || "OKPay",
        });
        setGwEnabled({
          qwackpay: !!(s.qwackpay && s.qwackpay.enabled),
          okpay: !!(s.okpay && s.okpay.enabled),
        });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const setManual = (k, v) => setCfg((c) => ({ ...c, manual: { ...c.manual, [k]: v } }));

  /* Quick amounts — free text, parsed on save */
  const parseQuick = () =>
    quickText
      .split(/[,\s]+/)
      .map((x) => Number(x.replace(/\D/g, "")))
      .filter((n) => n > 0)
      .slice(0, MAX_QUICK);

  const addMethod = () => {
    if (cfg.methods.length >= MAX_METHODS) {
      showToast(`Maximum ${MAX_METHODS} payment methods allowed`, true);
      return;
    }
    setCfg((c) => ({
      ...c,
      methods: [...c.methods, { name: "", icon: "wallet", active: true }],
    }));
  };

  const updMethod = (i, patch) =>
    setCfg((c) => ({
      ...c,
      methods: c.methods.map((m, mi) => (mi === i ? { ...m, ...patch } : m)),
    }));

  const delMethod = (i) => {
    setCfg((c) => ({ ...c, methods: c.methods.filter((_, mi) => mi !== i) }));
    setPick(null);
  };

  /* QR image upload — stored on the server, auto-runs on file select */
  const uploadQr = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return showToast("Only image files are allowed (JPG/PNG/WebP/GIF)", true);
    if (file.size > 32 * 1024 * 1024) return showToast("Maximum image size is 32MB", true);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const d = await api("/api/admin/upload", {
          method: "POST",
          body: JSON.stringify({
            image: reader.result,
            name: file.name.replace(/\.[^.]+$/, ""),
          }),
        });
        setManual("qrImage", d.url);
        showToast("QR image uploaded successfully");
      } catch (e) {
        showToast(e.message, true);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setUploading(false);
      showToast("File read failed — please try again", true);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const minA = Number(cfg.minAmount) || 0;
    const maxA = Number(cfg.maxAmount) || 0;
    if (minA <= 0) return showToast("Enter a valid minimum amount", true);
    if (maxA > 0 && maxA < minA)
      return showToast("Maximum amount must be greater than minimum", true);
    if (!cfg.methods.some((m) => m.active))
      return showToast("Enable at least one payment method", true);
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          recharge: {
            minAmount: minA,
            maxAmount: maxA,
            quickAmounts: parseQuick(),
            methods: cfg.methods,
            manual: cfg.manual,
          },
          /* auto-gateway display names — field-level merge, gateway
             credentials are never touched from this page */
          qwackpay: { displayName: gwNames.qwackpay.trim() || "QwackPay" },
          okpay: { displayName: gwNames.okpay.trim() || "OKPay" },
        }),
      });
      showToast("Recharge settings saved — live on the client /recharge page");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Recharge Setting"
      sub="Full control of the client /recharge page — limits, methods and manual payment"
    >
      <Toast message={toast} isError={isError} />

      {!cfg ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[860px] flex-col gap-3.5 sm:gap-5">
          {/* ===== LIMITS ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Percent size={17} className="text-brand-700" />
              <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                Recharge Limits
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Minimum Amount (₹)" hint="Client + server both validate this">
                <TextInput
                  type="number"
                  min="0"
                  value={cfg.minAmount}
                  onChange={(e) => set("minAmount", e.target.value)}
                />
              </Field>
              <Field label="Maximum Amount (₹)" hint="0 = no maximum limit">
                <TextInput
                  type="number"
                  min="0"
                  value={cfg.maxAmount}
                  onChange={(e) => set("maxAmount", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ===== QUICK AMOUNTS ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Zap size={17} className="text-brand-700" />
              <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                Quick Amounts
              </div>
            </div>
            <Field
              label="Quick Buttons"
              hint={`Comma separated — up to ${MAX_QUICK} buttons (e.g. 600, 2200, 5500)`}
            >
              <TextInput
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder="600, 2200, 5500"
              />
            </Field>
          </div>

          {/* ===== PAYMENT METHODS ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-3.5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet size={17} className="text-brand-700" />
                <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                  Payment Methods
                </div>
              </div>
              <span className="rounded-full bg-[var(--color-tint2)] px-3 py-1 text-[11.5px] font-bold text-brand-700">
                {cfg.methods.length} / {MAX_METHODS}
              </span>
            </div>

            <div className="rounded-xl bg-[var(--color-tint)] px-4 py-2.5 text-[12px] font-medium leading-relaxed text-[#475569]">
              Only active methods appear on the client recharge page. Toggle off to hide a
              method without deleting it.
            </div>

            {cfg.methods.length === 0 && (
              <div className="rounded-xl border border-dashed border-line py-8 text-center text-[13px] font-semibold text-muted">
                No payment methods yet — add your first method below
              </div>
            )}

            {cfg.methods.map((m, i) => {
              const CurIcon = (METHOD_ICONS.find((x) => x.key === m.icon) || METHOD_ICONS[2])
                .Icon;
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-white p-2.5"
                >
                  {/* Icon button + picker */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      title="Change icon"
                      onClick={() => setPick(pick === i ? null : i)}
                      className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border border-line bg-[var(--color-tint2)] text-brand-600 transition-colors hover:bg-[var(--color-tint2)]"
                    >
                      <CurIcon size={17} />
                    </button>

                    {pick === i && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPick(null)} />
                        <div className="absolute left-0 top-12 z-20 grid w-[188px] grid-cols-3 gap-1.5 rounded-xl border border-line bg-white p-2 shadow-[0_16px_40px_rgba(30,27,75,0.25)]">
                          {METHOD_ICONS.map(({ key, Icon: OIcon }) => (
                            <button
                              key={key}
                              type="button"
                              title={key}
                              onClick={() => {
                                updMethod(i, { icon: key });
                                setPick(null);
                              }}
                              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-[9px] transition-all ${
                                m.icon === key
                                  ? "brand-grad text-white"
                                  : "bg-[var(--color-tint2)] text-brand-600 hover:bg-[var(--color-tint2)]"
                              }`}
                            >
                              <OIcon size={16} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <TextInput
                    value={m.name}
                    onChange={(e) => updMethod(i, { name: e.target.value })}
                    placeholder={`Method name (e.g. Pay-T)`}
                    maxLength={30}
                    className="min-w-[140px] flex-1"
                  />

                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-muted">
                      {m.active ? "Active" : "Hidden"}
                    </span>
                    <Switch
                      checked={!!m.active}
                      onChange={(v) => updMethod(i, { active: v })}
                    />
                  </div>

                  <button
                    type="button"
                    title="Delete method"
                    onClick={() => delMethod(i)}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-transparent bg-[#fdecec] text-[#dc2626] transition-colors hover:bg-[#fbdcdc]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addMethod}
              disabled={cfg.methods.length >= MAX_METHODS}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-600/40 bg-[var(--color-tint)] py-3 text-[13.5px] font-extrabold text-brand-700 transition-all hover:bg-[var(--color-tint2)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />
              Add Payment Method
            </button>
          </div>

          {/* ===== AUTO PAYMENT (gateway display names) ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GatewayIcon size={17} className="text-brand-700" />
                <div>
                  <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                    Auto Payment (Gateways)
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-muted">
                    The automatic UPI methods shown above the manual methods on /recharge
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {GW_META.map((g) => (
                <Field
                  key={g.id}
                  label={g.label + " Display Name"}
                  hint="Users see this label on the payment method"
                >
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={gwNames[g.id]}
                      onChange={(e) => setGwNames((n) => ({ ...n, [g.id]: e.target.value }))}
                      placeholder={g.def}
                      maxLength={40}
                    />
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.4px] ${
                        gwEnabled[g.id]
                          ? "bg-[#eafaf0] text-[#16a34a]"
                          : "bg-[#fdecec] text-[#dc2626]"
                      }`}
                    >
                      {gwEnabled[g.id] ? "On" : "Off"}
                    </span>
                  </div>
                </Field>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-[var(--color-tint)] px-3 py-2.5 sm:px-4 sm:py-3 text-[12px] font-medium leading-relaxed text-[#475569]">
              <Zap size={15} className="mt-0.5 shrink-0 text-brand-600" />
              <span>
                Turning the gateways on / off and their keys live in{" "}
                <a href="/admin/settings/payment" className="font-bold text-brand-700 underline">
                  Payment Gateway
                </a>{" "}
                — this page only renames what users see on the recharge page.
              </span>
            </div>
          </div>

          {/* ===== MANUAL PAYMENT PAGE ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <QrCode size={17} className="text-brand-700" />
                <div>
                  <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                    Manual Payment Page
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-muted">
                    Shown when the user taps Pay on the recharge page
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.4px] ${
                    cfg.manual.enabled
                      ? "bg-[#eafaf0] text-[#16a34a]"
                      : "bg-[#fdecec] text-[#dc2626]"
                  }`}
                >
                  {cfg.manual.enabled ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  checked={!!cfg.manual.enabled}
                  onChange={(v) => setManual("enabled", v)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Page Title">
                <TextInput
                  value={cfg.manual.title}
                  onChange={(e) => setManual("title", e.target.value)}
                  placeholder="Manual Payment"
                  maxLength={60}
                />
              </Field>
              <Field label="Account / Holder Name">
                <TextInput
                  value={cfg.manual.accountName}
                  onChange={(e) => setManual("accountName", e.target.value)}
                  placeholder="e.g. Aramco Payments"
                  maxLength={80}
                />
              </Field>
            </div>

            <Field label="UPI ID" hint="Users can copy this with one tap on the client">
              <TextInput
                value={cfg.manual.upiId}
                onChange={(e) => setManual("upiId", e.target.value)}
                placeholder="e.g. aramco@upi"
                maxLength={120}
              />
            </Field>

            <Field label="QR Image (optional)" hint="Stored on the server — shown inside the payment sheet">
              <div className="flex items-center gap-3">
                {cfg.manual.qrImage ? (
                  <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl border border-line bg-white">
                    <Image
                      src={cfg.manual.qrImage}
                      alt="Payment QR"
                      fill
                      unoptimized
                      sizes="76px"
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-xl border border-dashed border-line bg-[var(--color-tint)] text-muted">
                    <QrCode size={26} strokeWidth={1.6} />
                  </div>
                )}
                <div className="flex flex-1 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current && fileRef.current.click()}
                    disabled={uploading}
                    className="admin-btn admin-btn-ghost"
                  >
                    <Upload size={15} />
                    {uploading ? "Uploading..." : "Upload QR"}
                  </button>
                  {cfg.manual.qrImage && (
                    <button
                      type="button"
                      onClick={() => setManual("qrImage", "")}
                      className="admin-btn admin-btn-danger"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadQr(e.target.files && e.target.files[0])}
                />
              </div>
            </Field>

            <Field label="Instructions / Note" hint="Extra text shown under the payment details">
              <TextArea
                value={cfg.manual.note}
                onChange={(e) => setManual("note", e.target.value)}
                placeholder="Pay the exact amount, then tap I Have Paid. Your recharge will be credited after verification."
                maxLength={300}
              />
            </Field>
          </div>

          {/* ===== SAVE ===== */}
          <div className="sticky bottom-3 flex justify-end sm:bottom-4">
            <button
              type="button"
              className="admin-btn admin-btn-primary w-full px-6 shadow-[0_10px_26px_rgba(79,70,229,0.35)] sm:w-auto sm:px-8"
              onClick={save}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Recharge Settings"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

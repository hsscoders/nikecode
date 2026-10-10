"use client";

import { useEffect, useState } from "react";
import {
  Save,
  Plus,
  Trash2,
  Power,
  TrendingUp,
  Users,
  IndianRupee,
  CreditCard,
  Gift,
  Star,
  Zap,
  CircleCheck,
  MessageSquareText,
  Type,
} from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  Switch,
  Loader,
  Toast,
  useToast,
} from "../../../../components/ui";

/* Icon options — the client app renders lucide icons from these keys */
const ICONS = [
  { key: "trending", Icon: TrendingUp },
  { key: "users", Icon: Users },
  { key: "rupee", Icon: IndianRupee },
  { key: "card", Icon: CreditCard },
  { key: "gift", Icon: Gift },
  { key: "star", Icon: Star },
  { key: "zap", Icon: Zap },
  { key: "check", Icon: CircleCheck },
];

const MAX_BULLETS = 12;

export default function PopupSettingsPage() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState(null); // index of the bullet with an open icon picker
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const p = d.settings && d.settings.popup ? d.settings.popup : {};
        setCfg({
          enabled: true,
          title: "",
          subtitle: "",
          buttonText: "",
          buttonUrl: "",
          ...p,
          bullets: Array.isArray(p.bullets) ? p.bullets : [],
        });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const addBullet = () => {
    if (cfg.bullets.length >= MAX_BULLETS) {
      showToast(`Maximum ${MAX_BULLETS} text lines allowed`, true);
      return;
    }
    setCfg((c) => ({ ...c, bullets: [...c.bullets, { text: "", icon: "check" }] }));
  };

  const updBullet = (i, patch) =>
    setCfg((c) => ({
      ...c,
      bullets: c.bullets.map((b, bi) => (bi === i ? { ...b, ...patch } : b)),
    }));

  const delBullet = (i) => {
    setCfg((c) => ({ ...c, bullets: c.bullets.filter((_, bi) => bi !== i) }));
    setPick(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        popup: {
          enabled: !!cfg.enabled,
          title: cfg.title,
          subtitle: cfg.subtitle,
          buttonText: cfg.buttonText,
          buttonUrl: cfg.buttonUrl,
          bullets: cfg.bullets,
        },
      };
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast("Popup settings saved — live on the client home page");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Popup Settings"
      sub="Manage the welcome popup shown on the client home page"
    >
      <Toast message={toast} isError={isError} />

      {!cfg ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[860px] flex-col gap-5">
          {/* ===== STATUS CARD ===== */}
          <div className="admin-card flex flex-wrap items-center gap-4 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-white shadow-[0_6px_16px_rgba(124,29,51,0.3)]">
              <Power size={19} />
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="font-display text-[15.5px] font-bold text-ink">
                Popup Visibility
              </div>
              <div className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-muted-rose">
                {cfg.enabled
                  ? "Popup is ON — it opens automatically on the client home page."
                  : "Popup is OFF — hidden from all users until you enable it again."}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.4px] ${
                  cfg.enabled
                    ? "bg-[#eafaf0] text-[#16a34a]"
                    : "bg-[#fdecec] text-[#dc2626]"
                }`}
              >
                {cfg.enabled ? "Enabled" : "Disabled"}
              </span>
              <Switch checked={cfg.enabled} onChange={(v) => set("enabled", v)} />
            </div>
          </div>

          {/* ===== CONTENT CARD ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <MessageSquareText size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">Popup Content</div>
            </div>

            <Field label="Title" hint="Big heading under the popup logo">
              <TextInput
                value={cfg.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Welcome to SAUDI ARAMCO"
                maxLength={80}
              />
            </Field>

            <Field label="Subtitle" hint="Small line shown below the title">
              <TextInput
                value={cfg.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="Earn daily withdraw daily"
                maxLength={120}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Button Text">
                <TextInput
                  value={cfg.buttonText}
                  onChange={(e) => set("buttonText", e.target.value)}
                  placeholder="Join Telegram Channel"
                  maxLength={60}
                />
              </Field>
              <Field label="Button URL (optional)" hint="Leave blank to show a coming-soon toast">
                <TextInput
                  value={cfg.buttonUrl}
                  onChange={(e) => set("buttonUrl", e.target.value)}
                  placeholder="https://t.me/yourchannel"
                  maxLength={500}
                />
              </Field>
            </div>
          </div>

          {/* ===== BULLETS CARD ===== */}
          <div className="admin-card flex flex-col gap-3.5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Type size={17} className="text-maroon-700" />
                <div className="font-display text-[16px] font-bold text-ink">Text Bullets</div>
              </div>
              <span className="rounded-full bg-[#fbf1f3] px-3 py-1 text-[11.5px] font-bold text-maroon-700">
                {cfg.bullets.length} / {MAX_BULLETS}
              </span>
            </div>

            <div className="rounded-xl bg-[#fbf3f4] px-4 py-2.5 text-[12px] font-medium leading-relaxed text-[#7d6a6e]">
              These lines appear inside the home page popup. Click the icon to change it,
              type the text, then press Save. Changes reflect on the client instantly.
            </div>

            {cfg.bullets.length === 0 && (
              <div className="rounded-xl border border-dashed border-line-rose py-8 text-center text-[13px] font-semibold text-muted-rose">
                No text bullets yet — add your first line below
              </div>
            )}

            {cfg.bullets.map((b, i) => {
              const CurIcon = (ICONS.find((x) => x.key === b.icon) || ICONS[7]).Icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-xl border border-line-rose bg-white p-2.5"
                >
                  {/* Icon button + picker */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      title="Change icon"
                      onClick={() => setPick(pick === i ? null : i)}
                      className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-[#fbf1f3] text-maroon-600 transition-colors hover:bg-[#f7e3e7]"
                    >
                      <CurIcon size={17} />
                    </button>

                    {pick === i && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPick(null)} />
                        <div className="absolute left-0 top-12 z-20 grid w-[188px] grid-cols-4 gap-1.5 rounded-xl border border-line-rose bg-white p-2 shadow-[0_16px_40px_rgba(66,9,26,0.25)]">
                          {ICONS.map(({ key, Icon: OIcon }) => (
                            <button
                              key={key}
                              type="button"
                              title={key}
                              onClick={() => {
                                updBullet(i, { icon: key });
                                setPick(null);
                              }}
                              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-[9px] transition-all ${
                                b.icon === key
                                  ? "bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-white"
                                  : "bg-[#fbf1f3] text-maroon-600 hover:bg-[#f7e3e7]"
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
                    value={b.text}
                    onChange={(e) => updBullet(i, { text: e.target.value })}
                    placeholder={`Text line ${i + 1} (e.g. Daily income & daily withdrawals)`}
                    maxLength={120}
                    className="flex-1"
                  />

                  <button
                    type="button"
                    title="Delete line"
                    onClick={() => delBullet(i)}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-transparent bg-[#fdecec] text-[#dc2626] transition-colors hover:bg-[#fbdcdc]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addBullet}
              disabled={cfg.bullets.length >= MAX_BULLETS}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-maroon-600/40 bg-[#fdf7f8] py-3 text-[13.5px] font-extrabold text-maroon-700 transition-all hover:bg-[#fbf1f3] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} />
              Add New Text
            </button>
          </div>

          {/* ===== SAVE ===== */}
          <div className="sticky bottom-4 flex justify-end">
            <button
              type="button"
              className="admin-btn admin-btn-primary px-8 shadow-[0_10px_26px_rgba(124,29,51,0.35)]"
              onClick={save}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Popup Settings"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
